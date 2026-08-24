//! UI-neutral projection of AIKit's Agent-Wiki maintenance result.
//!
//! AIKit keeps canonical `WikiObject` values inside its owner plan. O:I only
//! projects the stable identity/revision/kind facts needed to present the return;
//! it does not serialise, copy or persist a second Wiki object representation.

use aikit_core::{AgentWikiMaintenancePlan, WikiObject};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LivingWikiObjectSummary {
    pub resource_ref: String,
    pub revision: u64,
    pub object_kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LivingHumanSourceProposal {
    pub source: String,
    pub reason: String,
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LivingAgentWikiPlanReading {
    pub current_index_revision: String,
    pub stale_resources: Vec<String>,
    pub next_objects: Vec<LivingWikiObjectSummary>,
    pub human_source_proposals: Vec<LivingHumanSourceProposal>,
}

pub fn project_agent_wiki_plan(plan: &AgentWikiMaintenancePlan) -> LivingAgentWikiPlanReading {
    LivingAgentWikiPlanReading {
        current_index_revision: plan.current_index_revision.clone(),
        stale_resources: plan
            .stale_resources
            .iter()
            .map(ToString::to_string)
            .collect(),
        next_objects: plan
            .next_objects
            .iter()
            .map(|object| LivingWikiObjectSummary {
                resource_ref: object.ref_id().to_string(),
                revision: object.revision(),
                object_kind: object_kind(object).into(),
            })
            .collect(),
        human_source_proposals: plan
            .human_source_proposals
            .iter()
            .map(|proposal| LivingHumanSourceProposal {
                source: proposal.source.to_string(),
                reason: proposal.reason.clone(),
                evidence: proposal.evidence.iter().map(ToString::to_string).collect(),
            })
            .collect(),
    }
}

fn object_kind(object: &WikiObject) -> &'static str {
    match object {
        WikiObject::Space(_) => "space",
        WikiObject::Node(_) => "node",
        WikiObject::Edge(_) => "edge",
        WikiObject::Frame(_) => "frame",
        WikiObject::Reading(_) => "reading",
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use aikit_core::{
        AgentWikiMaintenancePlan, HumanSourceRevisionProposal, ResourceRef, SourceRef, WikiNode,
        WikiObject,
    };

    use super::*;

    #[test]
    fn projection_exposes_identity_revision_kind_and_proposal_without_wiki_body_copy() {
        let node = WikiObject::Node(WikiNode {
            profile: "okf-wiki/v1".into(),
            ref_id: ResourceRef::parse("wiki:node:purpose").unwrap(),
            revision: 4,
            provenance: vec![],
            node_type: "purpose".into(),
            title: Some("Private internal title not needed by return projection".into()),
            space_refs: vec![],
            source_refs: vec![],
            local_space_ref: None,
            extensions: BTreeMap::new(),
        });
        let plan = AgentWikiMaintenancePlan {
            current_index_revision: "index-r7".into(),
            stale_resources: vec![ResourceRef::parse("wiki:node:prior").unwrap()],
            next_objects: vec![node],
            human_source_proposals: vec![HumanSourceRevisionProposal {
                source: SourceRef::parse("central:source:project:test:README.md").unwrap(),
                reason: "Review the authored wording".into(),
                evidence: vec![],
            }],
        };

        let reading = project_agent_wiki_plan(&plan);
        assert_eq!(reading.next_objects.len(), 1);
        assert_eq!(reading.next_objects[0].resource_ref, "wiki:node:purpose");
        assert_eq!(reading.next_objects[0].revision, 4);
        assert_eq!(reading.next_objects[0].object_kind, "node");
        assert_eq!(reading.human_source_proposals.len(), 1);
        assert_eq!(
            reading.human_source_proposals[0].source,
            "central:source:project:test:README.md"
        );

        let json = serde_json::to_string(&reading).unwrap();
        assert!(!json.contains("Private internal title"));
        assert!(!json.contains("node_type"));
        assert!(json.contains("wiki:node:purpose"));
        assert!(json.contains("Review the authored wording"));
    }
}
