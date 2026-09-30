//! A completed native Nara answer may accompany one explicitly chosen focus.
//! The transcript is evidence, never an executable command language. The host
//! applies the prepared change only after comparing the complete captured
//! document and profile lineage under its existing Expression mutex.
use crate::{agency, expression, flow::CentralClient, nara_dialogue};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Status {
        binding: nara_dialogue::Request,
    },
    Inspect {
        binding: nara_dialogue::Request,
        answer_block_id: u64,
    },
    Focus {
        binding: nara_dialogue::Request,
        answer_block_id: u64,
        target_ref: String,
    },
    Restore {
        binding: nara_dialogue::Request,
        act_ref: String,
        expected_revision: u64,
    },
}
impl Request {
    pub fn binding(&self) -> &nara_dialogue::Request {
        match self {
            Self::Status { binding }
            | Self::Inspect { binding, .. }
            | Self::Focus { binding, .. }
            | Self::Restore { binding, .. } => binding,
        }
    }
}
pub struct Prepared {
    client: CentralClient,
    agency: agency::Client,
    cwd: PathBuf,
    project: String,
    request: Request,
    document: Value,
    profile: nara_dialogue::ProfileBasis,
    context_state: nara_dialogue::ContextState,
}
pub enum PreparedOutcome {
    Read(Value),
    Focus(Box<PreparedFocus>),
    Restore(Box<PreparedRestore>),
}
pub struct PreparedRestore {
    pub binding: nara_dialogue::Request,
    pub captured_document: Value,
    pub captured_profile: nara_dialogue::ProfileBasis,
    pub agent_session_ref: String,
    pub act_ref: String,
    pub expected_revision: u64,
}
pub struct PreparedFocus {
    pub(crate) context_state: nara_dialogue::ContextState,
    pub binding: nara_dialogue::Request,
    pub captured_document: Value,
    pub captured_profile: nara_dialogue::ProfileBasis,
    pub act_ref: String,
    pub checkpoint_ref: String,
    pub agent_session_ref: String,
    pub answer_block_ids: Value,
    pub target: Value,
    pub request: expression::Request,
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
            context_state: nara_dialogue::ContextState::default(),
        }
    }
    pub(crate) fn with_context_state(mut self, state: nara_dialogue::ContextState) -> Self {
        self.context_state = state;
        self
    }
    pub fn execute(self) -> Result<PreparedOutcome, String> {
        let binding = self.request.binding();
        if binding.role != nara_dialogue::Role::Nara {
            return Err("ExpressiveAct requires the actual Nara binding".into());
        }
        let block = match self.request {
            Request::Inspect {
                answer_block_id, ..
            }
            | Request::Focus {
                answer_block_id, ..
            } => answer_block_id,
            Request::Restore { .. } | Request::Status { .. } => 0,
        };
        let native = nara_dialogue::Binding::new(&self.project, binding)?;
        let current = nara_dialogue::read_context_with_state(
            &self.client,
            &self.project,
            binding,
            &self.document,
            &self.profile,
            &self.context_state,
        )?;
        if matches!(self.request, Request::Status { .. }) {
            return Ok(PreparedOutcome::Read(
                json!({"schema":"oi.nara-expressive-act-status/v1",
                "nara_ref":binding.nara_ref,"expression_ref":binding.expression_ref,
                "expression_revision":self.document["revision"],"context_ref":current["context"]["context_ref"],
                "state":self.context_state.expressive_act,"checkpoint_available":self.context_state.expressive_act.is_object(),
                "dynamic_checkpoint":false}),
            ));
        }
        if let Request::Restore {
            act_ref,
            expected_revision,
            ..
        } = &self.request
        {
            return Ok(PreparedOutcome::Restore(Box::new(PreparedRestore {
                binding: binding.clone(),
                captured_document: self.document,
                captured_profile: self.profile,
                agent_session_ref: native.agent_session,
                act_ref: act_ref.clone(),
                expected_revision: *expected_revision,
            })));
        }
        let answer = crate::nara_voice_answer::read(
            &self.agency,
            &self.cwd,
            &self.project,
            &native.agent_session,
            block,
            &current["context"],
        )?;
        let text = answer["text"]
            .as_str()
            .ok_or("The completed native answer has no text")?;
        let targets = cited_targets(&self.document, &current["context"], text)?;
        let digest = format!(
            "{:x}",
            Sha256::digest(
                serde_json::to_vec(&json!([
                    binding,
                    current["context"],
                    answer["answer_block_ids"],
                    self.document
                ]))
                .map_err(|e| e.to_string())?
            )
        );
        let act_ref = format!("oi:nara-act:{digest}");
        let checkpoint_ref = format!("{act_ref}:checkpoint");
        match &self.request {
            Request::Inspect { .. } => Ok(PreparedOutcome::Read(json!({
                "schema":"oi.nara-expressive-act-review/v1", "act_ref":act_ref,
                "checkpoint_ref":checkpoint_ref,"agent_session_ref":native.agent_session,
                "nara_ref":binding.nara_ref,"expression_ref":binding.expression_ref,
                "expression_revision":self.document["revision"],"answer_block_ids":answer["answer_block_ids"],
                "targets":targets,"choice_required":targets.len()>1,"effect_applied":false,
                "standing":"exact native completed-answer references; explicit focus choice only"
            }))),
            Request::Focus { target_ref, .. } => {
                let matches: Vec<_> = targets.iter().filter(|t| t["ref"] == *target_ref).collect();
                if matches.len() != 1 {
                    return Err(
                        "Choose one unambiguous exact reference cited by this native answer".into(),
                    );
                }
                let target = matches[0].clone();
                let change: expression::Change =
                    serde_json::from_value(target["change"].clone()).map_err(|e| e.to_string())?;
                let revision = self.document["revision"]
                    .as_u64()
                    .ok_or("Native Expression revision unavailable")?;
                if target["effect_required"] == false {
                    return Ok(PreparedOutcome::Read(
                        json!({"schema":"oi.nara-expressive-act-effect/v1",
                        "operation":"focus","act_ref":act_ref,"checkpoint_ref":checkpoint_ref,
                        "nara_ref":binding.nara_ref,"expression_ref":binding.expression_ref,
                        "expression_revision":revision,"effect_applied":false,"dynamic_checkpoint":false,
                        "reason":"The cited target is already selected; no checkpoint was created"}),
                    ));
                }
                Ok(PreparedOutcome::Focus(Box::new(PreparedFocus {
                    context_state: self.context_state.clone(),
                    binding: binding.clone(),
                    captured_document: self.document,
                    captured_profile: self.profile,
                    act_ref,
                    checkpoint_ref,
                    agent_session_ref: native.agent_session.clone(),
                    answer_block_ids: answer["answer_block_ids"].clone(),
                    target,
                    request: expression::Request::Edit {
                        expression_ref: binding.expression_ref.clone(),
                        expected_revision: revision,
                        actor: native.agent_session,
                        changes: vec![change],
                    },
                })))
            }
            Request::Restore { .. } | Request::Status { .. } => unreachable!(),
        }
    }
}

// Reference tokens have an explicit punctuation boundary. Substrings inside a
// longer semantic reference, display-name mentions and generated JSON commands
// never acquire authority from this check.
fn cites(text: &str, reference: &str) -> bool {
    let boundary = |c: char| {
        c.is_whitespace()
            || matches!(
                c,
                '`' | '"'
                    | '\''
                    | '('
                    | ')'
                    | '['
                    | ']'
                    | '{'
                    | '}'
                    | ','
                    | ';'
                    | '<'
                    | '>'
                    | '!'
                    | '?'
            )
    };
    text.match_indices(reference).any(|(at, _)| {
        text[..at].chars().next_back().is_none_or(boundary)
            && text[at + reference.len()..]
                .chars()
                .next()
                .is_none_or(boundary)
    })
}
fn cited_targets(document: &Value, context: &Value, answer: &str) -> Result<Vec<Value>, String> {
    let selection = &document["selection"];
    let scene = document["scenes"]
        .as_array()
        .and_then(|rows| {
            rows.iter()
                .find(|s| s["scene_ref"] == selection["scene_ref"])
        })
        .ok_or("Select a native scene before reviewing an ExpressiveAct")?;
    let scene_ref = scene["scene_ref"]
        .as_str()
        .ok_or("Native scene reference unavailable")?;
    let mut candidates = vec![
        json!({"ref":scene_ref,"label":scene["title"],"kind":"scene",
        "change":{"change":"focus","scene_ref":scene_ref,"entity_ref":null}}),
    ];
    if let Some(entity_ref) = selection["entity_ref"].as_str() {
        let entity = &document["entities"][entity_ref];
        if let Some(reference) = entity["subject"]["subject_ref"].as_str() {
            if context["pointed_ref"] == reference
                && scene["entity_refs"]
                    .as_array()
                    .is_some_and(|rows| rows.iter().any(|r| r == entity_ref))
            {
                candidates.push(
                    json!({"ref":reference,"label":entity["title"],"kind":"subject",
                    "change":{"change":"focus","scene_ref":scene_ref,"entity_ref":entity_ref}}),
                );
            }
        }
    }
    if let Some(binding_ref) = selection["relation_ref"].as_str() {
        let relation = &document["relations"][binding_ref];
        if let Some(reference) = relation["relation"]["ref"].as_str() {
            if context["pointed_ref"] == reference
                && relation["relation"]["availability"] == "available"
                && scene["entity_refs"].as_array().is_some_and(|rows| {
                    rows.contains(&relation["from_entity_ref"])
                        && rows.contains(&relation["to_entity_ref"])
                })
            {
                candidates.push(json!({"ref":reference,"label":reference,"kind":"relation",
                    "change":{"change":"relation_focus","scene_ref":scene_ref,"binding_ref":binding_ref}}));
            }
        }
    }
    for target in &mut candidates {
        let change = &target["change"];
        let desired = if change["change"] == "relation_focus" {
            json!({"scene_ref":change["scene_ref"],"entity_ref":null,"relation_ref":change["binding_ref"]})
        } else {
            json!({"scene_ref":change["scene_ref"],"entity_ref":change["entity_ref"],"relation_ref":null})
        };
        // Native Selection omits an absent relation_ref during serialization.
        // Compare its three semantic fields, not JSON object key presence.
        target["effect_required"] = json!(
            selection["scene_ref"] != desired["scene_ref"]
                || selection["entity_ref"] != desired["entity_ref"]
                || selection["relation_ref"] != desired["relation_ref"]
        );
    }
    Ok(candidates
        .into_iter()
        .filter(|t| t["ref"].as_str().is_some_and(|r| cites(answer, r)))
        .collect())
}

/// Ephemeral native host state, alongside its existing Expression session. No
/// renderer-supplied document is accepted as an act checkpoint. The host retains
/// one of these only after committing the prepared focus under its mutex.
pub struct Checkpoint {
    pub captured_profile: nara_dialogue::ProfileBasis,
    binding: nara_dialogue::Request,
    act_ref: String,
    checkpoint_ref: String,
    before: Value,
    after: Value,
}
impl std::fmt::Debug for Checkpoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ExpressiveActCheckpoint")
            .field("act_ref", &self.act_ref)
            .finish_non_exhaustive()
    }
}
impl Checkpoint {
    pub(crate) fn context_state(
        &self,
        binding: &nara_dialogue::Request,
        document: &Value,
        profile: &nara_dialogue::ProfileBasis,
    ) -> Option<Value> {
        let mut expected = self.binding.clone();
        expected.operation = binding.operation.clone();
        expected.role = binding.role.clone();
        if expected != *binding || document != &self.after || profile != &self.captured_profile {
            return None;
        }
        Some(
            json!({"expressive_act_ref":self.act_ref,"phase":"completed",
            "basis_expression_revision":self.after["revision"].as_u64()?.to_string(),"speech_turn_ref":null,
            "checkpoint":{"checkpoint_ref":self.checkpoint_ref,
                "checkpoint_expression_revision":self.before["revision"].as_u64()?.to_string()}}),
        )
    }
    pub fn expression_ref(&self) -> &str {
        &self.binding.expression_ref
    }
    pub fn committed(focus: &PreparedFocus, actual_after: Value) -> Result<Self, String> {
        if actual_after["expression_ref"] != focus.binding.expression_ref
            || actual_after["revision"].as_u64()
                != focus.captured_document["revision"]
                    .as_u64()
                    .and_then(|r| r.checked_add(1))
        {
            return Err("ExpressiveAct checkpoint requires the actual next native document".into());
        }
        Ok(Self {
            captured_profile: nara_dialogue::ProfileBasis {
                profile: focus.captured_profile.profile.clone(),
                lineage: focus.captured_profile.lineage.clone(),
            },
            binding: focus.binding.clone(),
            act_ref: focus.act_ref.clone(),
            checkpoint_ref: focus.checkpoint_ref.clone(),
            before: focus.captured_document.clone(),
            after: actual_after,
        })
    }
    pub fn restore_request(
        &self,
        binding: &nara_dialogue::Request,
        act_ref: &str,
        expected_revision: u64,
        current: &Value,
    ) -> Result<expression::Request, String> {
        let mut expected = self.binding.clone();
        expected.operation = binding.operation.clone();
        if expected != *binding
            || act_ref != self.act_ref
            || current != &self.after
            || current["revision"] != expected_revision
        {
            return Err("The Nara binding or native Expression changed since this act; its checkpoint cannot overwrite intervening work".into());
        }
        let document = serde_json::from_value(self.before.clone()).map_err(|e| e.to_string())?;
        Ok(expression::Request::Restore {
            expression_ref: binding.expression_ref.clone(),
            expected_revision,
            document: Box::new(document),
            actor: format!("{}:checkpoint-return", binding.nara_ref),
        })
    }
    pub fn reading(&self) -> Value {
        json!({"act_ref":self.act_ref,"checkpoint_ref":self.checkpoint_ref,"nara_ref":self.binding.nara_ref,
            "expression_ref":self.binding.expression_ref,"checkpoint_expression_revision":self.before["revision"],
            "current_expression_revision":self.after["revision"],"dynamic_checkpoint":false})
    }
}

#[cfg(test)]
mod tests {
    use super::{cited_targets, cites};
    use serde_json::json;
    #[test]
    fn exact_semantic_reference_requires_both_token_boundaries() {
        assert!(cites("Focus `ql:m-coordinate:4-1`.", "ql:m-coordinate:4-1"));
        assert!(!cites("ql:m-coordinate:4-10", "ql:m-coordinate:4-1"));
        assert!(!cites("other:ql:m-coordinate:4-1", "ql:m-coordinate:4-1"));
        assert!(!cites("ql:m-coordinate:4-1.subref", "ql:m-coordinate:4-1"));
        assert!(!cites("Throat centre", "ql:m-coordinate:4-1"));
    }
    #[test]
    fn native_selection_omits_absent_relation_without_creating_a_focus_effect() {
        let selection = serde_json::to_value(crate::expression::Selection {
            scene_ref: "expression:one:scene:main".into(),
            entity_ref: Some("entity:root".into()),
            relation_ref: None,
        })
        .unwrap();
        let document = json!({"selection":selection,"scenes":[{"scene_ref":"expression:one:scene:main","title":"Scene","entity_refs":["entity:root"]}],
            "entities":{"entity:root":{"title":"Root","subject":{"subject_ref":"ql:m-coordinate:root"}}}});
        let targets = cited_targets(
            &document,
            &json!({"pointed_ref":"ql:m-coordinate:root"}),
            "`ql:m-coordinate:root` and `expression:one:scene:main`",
        )
        .unwrap();
        assert_eq!(
            targets.iter().find(|t| t["kind"] == "subject").unwrap()["effect_required"],
            false
        );
        assert_eq!(
            targets.iter().find(|t| t["kind"] == "scene").unwrap()["effect_required"],
            true
        );
    }
}
