//! Living Wiki desktop projection over native Central + AIKit owner contracts.
//!
//! Central remains source-change authority. AIKit remains impact/freshness,
//! integrative-reading and Contemplate authority. O:I adapts Central's public Action
//! result into AIKit's provider-neutral horizon and presents the returned owner
//! readings. It owns no dependency graph, watcher, Wiki, Agent runtime or background
//! invocation path.

use aikit_core::model_runtime::ModelRuntimeReadModel;
use aikit_core::{
    bounded_contemplate_preflight, deterministic_transitive_knowledge_impact,
    wiki_living_dependencies, BoundedContemplatePreflight, ContemplateRequest,
    KnowledgeChangeHorizon, KnowledgeChangeKind, KnowledgeObservedSource, KnowledgeSourceChange,
    KnowledgeTransitiveImpact, ProjectRef, QlRefractionRequest, ResourceRef, SemanticWikiIndex,
    SourceRef, SourceRevision, WikiObject, DEFAULT_CONTEMPLATE_OBJECT_BUDGET,
    DEFAULT_CONTEMPLATE_RELATION_DEPTH, DEFAULT_LIVING_IMPACT_DEPTH,
    DEFAULT_LIVING_IMPACT_RESOURCES,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const LIVING_WIKI_DESKTOP_VERSION: &str = "oi.desktop-living-wiki/v1";
pub const CENTRAL_SOURCE_HORIZON_SCHEMA: &str = "central.source-change-horizon/v1";

#[derive(Debug, Clone, Deserialize)]
pub struct CentralSourceBinding {
    #[serde(rename = "ref")]
    pub source_ref: String,
    pub path: String,
    #[serde(default)]
    pub roles: Vec<String>,
    pub provenance: String,
    pub standing: String,
    pub treatment: String,
    pub agent_retrieval_allowed: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CentralSourceRevision {
    pub revision: String,
    pub byte_len: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CentralObservedSource {
    pub binding: CentralSourceBinding,
    pub revision: CentralSourceRevision,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CentralSourceChangeKind {
    Added,
    Modified,
    Removed,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CentralSourceChange {
    pub cursor: u64,
    pub world_ref: String,
    pub source_ref: String,
    #[serde(default)]
    pub source_roles: Vec<String>,
    pub provenance: String,
    pub standing: String,
    pub agent_retrieval_allowed: bool,
    #[serde(default)]
    pub before_revision: Option<String>,
    #[serde(default)]
    pub after_revision: Option<String>,
    pub kind: CentralSourceChangeKind,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CentralSourceHorizon {
    pub schema: String,
    pub world_ref: String,
    pub cursor: u64,
    #[serde(default)]
    pub sources: Vec<CentralObservedSource>,
    #[serde(default)]
    pub changes: Vec<CentralSourceChange>,
    pub provider: String,
    pub source_payloads_exposed: bool,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct LivingWikiChangedSource {
    pub source_ref: String,
    pub cursor: u64,
    pub kind: String,
    pub roles: Vec<String>,
    pub provenance: String,
    pub standing: String,
    pub agent_retrieval_allowed: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct LivingWikiDesktopReading {
    pub version: String,
    pub world_ref: String,
    pub provider: String,
    pub cursor: u64,
    pub changed: Vec<LivingWikiChangedSource>,
    pub impact: KnowledgeTransitiveImpact,
    pub source_payloads_exposed: bool,
    pub automatic_agent_or_model_invocation: bool,
    pub source_authority_owner: String,
    pub impact_owner: String,
    pub contemplate_owner: String,
}

pub fn parse_central_horizon(value: Value) -> Result<CentralSourceHorizon, String> {
    let horizon: CentralSourceHorizon = serde_json::from_value(value)
        .map_err(|error| format!("Central Source Change Horizon shape is invalid: {error}"))?;
    if horizon.schema != CENTRAL_SOURCE_HORIZON_SCHEMA {
        return Err(format!(
            "Central Source Change Horizon schema `{}` is not `{CENTRAL_SOURCE_HORIZON_SCHEMA}`",
            horizon.schema
        ));
    }
    if horizon.source_payloads_exposed {
        return Err("Central Source Change Horizon unexpectedly exposed source payloads".into());
    }
    if horizon.automatic_agent_or_model_invocation {
        return Err("Central Source Change Horizon violated zero-background-Agent law".into());
    }
    Ok(horizon)
}

pub fn adapt_central_horizon(
    horizon: &CentralSourceHorizon,
) -> Result<KnowledgeChangeHorizon, String> {
    let sources = horizon
        .sources
        .iter()
        .map(|observed| {
            Ok(KnowledgeObservedSource {
                source: SourceRef::parse(&observed.binding.source_ref)
                    .map_err(|error| error.to_string())?,
                revision: Some(
                    SourceRevision::parse(&observed.revision.revision)
                        .map_err(|error| error.to_string())?,
                ),
                available: true,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    let changes = horizon
        .changes
        .iter()
        .map(|change| {
            Ok(KnowledgeSourceChange {
                cursor: change.cursor,
                world_ref: change.world_ref.clone(),
                source: SourceRef::parse(&change.source_ref).map_err(|error| error.to_string())?,
                roles: change.source_roles.clone(),
                provenance: change.provenance.clone(),
                standing: change.standing.clone(),
                before_revision: change
                    .before_revision
                    .as_deref()
                    .map(SourceRevision::parse)
                    .transpose()
                    .map_err(|error| error.to_string())?,
                after_revision: change
                    .after_revision
                    .as_deref()
                    .map(SourceRevision::parse)
                    .transpose()
                    .map_err(|error| error.to_string())?,
                kind: match change.kind {
                    CentralSourceChangeKind::Added => KnowledgeChangeKind::Added,
                    CentralSourceChangeKind::Modified => KnowledgeChangeKind::Modified,
                    CentralSourceChangeKind::Removed => KnowledgeChangeKind::Removed,
                },
                agent_retrieval_allowed: change.agent_retrieval_allowed,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(KnowledgeChangeHorizon {
        provider: horizon.provider.clone(),
        cursor: horizon.cursor,
        sources,
        changes,
    })
}

pub fn wiki_objects(index: &SemanticWikiIndex) -> Vec<WikiObject> {
    index
        .discover()
        .into_iter()
        .filter_map(|resource| index.resolve(&resource))
        .collect()
}

pub fn living_wiki_reading(
    central: &CentralSourceHorizon,
    index: &SemanticWikiIndex,
) -> Result<LivingWikiDesktopReading, String> {
    let horizon = adapt_central_horizon(central)?;
    let objects = wiki_objects(index);
    let (source_dependencies, resource_dependencies) =
        wiki_living_dependencies(&objects).map_err(|error| error.to_string())?;
    let impact = deterministic_transitive_knowledge_impact(
        &horizon,
        &source_dependencies,
        &resource_dependencies,
        DEFAULT_LIVING_IMPACT_DEPTH,
        DEFAULT_LIVING_IMPACT_RESOURCES,
    )
    .map_err(|error| error.to_string())?;
    let changed = central
        .changes
        .iter()
        .map(|change| LivingWikiChangedSource {
            source_ref: change.source_ref.clone(),
            cursor: change.cursor,
            kind: match change.kind {
                CentralSourceChangeKind::Added => "added",
                CentralSourceChangeKind::Modified => "modified",
                CentralSourceChangeKind::Removed => "removed",
            }
            .into(),
            roles: change.source_roles.clone(),
            provenance: change.provenance.clone(),
            standing: change.standing.clone(),
            agent_retrieval_allowed: change.agent_retrieval_allowed,
        })
        .collect();
    Ok(LivingWikiDesktopReading {
        version: LIVING_WIKI_DESKTOP_VERSION.into(),
        world_ref: central.world_ref.clone(),
        provider: central.provider.clone(),
        cursor: central.cursor,
        changed,
        impact,
        source_payloads_exposed: false,
        automatic_agent_or_model_invocation: false,
        source_authority_owner: "central".into(),
        impact_owner: "ai-kit".into(),
        contemplate_owner: "ai-kit".into(),
    })
}

pub fn living_wiki_preflight(
    project: ProjectRef,
    focus: Vec<ResourceRef>,
    central: &CentralSourceHorizon,
    index: &SemanticWikiIndex,
    runtime: &ModelRuntimeReadModel,
    ql: Option<QlRefractionRequest>,
) -> Result<BoundedContemplatePreflight, String> {
    let horizon = adapt_central_horizon(central)?;
    let objects = wiki_objects(index);
    let (source_dependencies, resource_dependencies) =
        wiki_living_dependencies(&objects).map_err(|error| error.to_string())?;
    bounded_contemplate_preflight(
        &ContemplateRequest {
            project,
            focus,
            horizon: &horizon,
            dependencies: &source_dependencies,
            current_wiki_objects: &objects,
            runtime,
            method: None,
            ql,
        },
        &resource_dependencies,
        DEFAULT_CONTEMPLATE_OBJECT_BUDGET,
        DEFAULT_CONTEMPLATE_RELATION_DEPTH,
    )
    .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use aikit_core::{
        KnowledgeFreshness, SemanticRevision, SemanticWikiReading, WikiNode, WikiProvenanceRef,
        INTEGRATIVE_READING_EXTENSION,
    };
    use std::collections::BTreeMap;

    fn central_fixture() -> CentralSourceHorizon {
        CentralSourceHorizon {
            schema: CENTRAL_SOURCE_HORIZON_SCHEMA.into(),
            world_ref: "project:test".into(),
            cursor: 2,
            sources: vec![CentralObservedSource {
                binding: CentralSourceBinding {
                    source_ref: "central:source:project:test:README.md".into(),
                    path: "README.md".into(),
                    roles: vec!["purpose".into()],
                    provenance: "human-authored".into(),
                    standing: "authored-human-position".into(),
                    treatment: "retained-in-place".into(),
                    agent_retrieval_allowed: true,
                },
                revision: CentralSourceRevision {
                    revision: "r2".into(),
                    byte_len: 42,
                },
            }],
            changes: vec![CentralSourceChange {
                cursor: 2,
                world_ref: "project:test".into(),
                source_ref: "central:source:project:test:README.md".into(),
                source_roles: vec!["purpose".into()],
                provenance: "human-authored".into(),
                standing: "authored-human-position".into(),
                agent_retrieval_allowed: true,
                before_revision: Some("r1".into()),
                after_revision: Some("r2".into()),
                kind: CentralSourceChangeKind::Modified,
            }],
            provider: "central.filesystem-reconcile/v1".into(),
            source_payloads_exposed: false,
            automatic_agent_or_model_invocation: false,
        }
    }

    #[test]
    fn retained_source_change_uses_owner_dependency_closure_without_payload_or_agent() {
        let source = SourceRef::parse("central:source:project:test:README.md").unwrap();
        let part_ref = ResourceRef::parse("wiki:node:part").unwrap();
        let whole_ref = ResourceRef::parse("wiki:reading:whole").unwrap();
        let part = WikiObject::Node(WikiNode {
            profile: "okf-wiki/v1".into(),
            ref_id: part_ref.clone(),
            revision: 1,
            provenance: vec![WikiProvenanceRef {
                source_ref: source,
                source_revision: Some(SemanticRevision::Text("r1".into())),
                producer_ref: None,
                generation_ref: None,
                extensions: BTreeMap::new(),
            }],
            node_type: "concept".into(),
            title: Some("Part".into()),
            space_refs: vec![],
            source_refs: vec![],
            local_space_ref: None,
            extensions: BTreeMap::new(),
        });
        let mut extensions = BTreeMap::new();
        extensions.insert(
            INTEGRATIVE_READING_EXTENSION.into(),
            serde_json::json!({
                "basis": [{"resource": part_ref}],
                "relations": [],
                "return_paths": [{"from_basis": part_ref, "through": [], "to_whole": whole_ref}],
                "freshness": KnowledgeFreshness::Fresh,
                "topology": "recursive-dag"
            }),
        );
        let whole = WikiObject::Reading(SemanticWikiReading {
            profile: "okf-wiki/v1".into(),
            ref_id: whole_ref.clone(),
            revision: 1,
            provenance: vec![],
            frame_ref: ResourceRef::parse("wiki:frame:test").unwrap(),
            reading_type: "integrative".into(),
            artifact_ref: None,
            derived_by_ref: Some(ResourceRef::parse("agent:test").unwrap()),
            extensions,
        });
        let index = SemanticWikiIndex::rebuild([part, whole]).unwrap();
        let result = living_wiki_reading(&central_fixture(), &index).unwrap();
        assert_eq!(result.changed.len(), 1);
        assert!(result
            .impact
            .direct
            .affected
            .iter()
            .any(|affected| affected.resource == part_ref));
        assert!(!result
            .impact
            .direct
            .affected
            .iter()
            .any(|affected| affected.resource == whole_ref));
        assert!(result.impact.pending_integration.contains(&whole_ref));
        assert!(result
            .impact
            .paths
            .iter()
            .any(|path| path.resource == whole_ref && path.steps.len() == 2));
        assert!(!result.source_payloads_exposed);
        assert!(!result.automatic_agent_or_model_invocation);
        assert!(!result.impact.automatic_agent_or_model_invocation);
    }

    #[test]
    fn privacy_survives_change_awareness_without_payload_disclosure() {
        let mut central = central_fixture();
        central.sources[0].binding.agent_retrieval_allowed = false;
        central.changes[0].agent_retrieval_allowed = false;
        let index = SemanticWikiIndex::default();
        let result = living_wiki_reading(&central, &index).unwrap();
        assert!(!result.changed[0].agent_retrieval_allowed);
        assert!(!result.source_payloads_exposed);
    }
}
