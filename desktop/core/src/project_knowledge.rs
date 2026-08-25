//! Local/private Project work field over ProjectCentral + AIKit Knowledge.
//!
//! ProjectCentral remains source/ground authority and SemanticWiki remains Wiki
//! relation authority. O:I composes their native AIKit readings; it does not own
//! source identity, Project identity, Wiki state, ProjectMap graph state, or Agent
//! Context disclosure. Stable selection remains a separate host concern.

use std::path::Path;
use std::sync::Mutex;

use aikit_adapters::{
    authored_relation_dependencies, authored_wiki_subject_relations,
    compile_authored_wiki_relations, projectcentral_authored_wiki,
    rebuild_semantic_wiki_with_authored_relations, AuthoredWikiRelationCompilation,
    AuthoredWikiSourceProjection, AuthoredWikiSubjectRelations, ProjectCentralFilesystemBinding,
};
use aikit_core::model_runtime::ModelRuntimeReadModel;
use aikit_core::resource::{MemoryResourceIndex, ResourceKind};
use aikit_core::{
    bounded_contemplate_preflight, deterministic_transitive_knowledge_impact,
    explicit_bounded_contemplate, explicit_flow_contemplate, first_party_flow_method,
    first_party_flow_resource_records, flow_contemplate_preflight, resolve_praxis,
    wiki_living_dependencies, AikitError, BoundedContemplateExecutor, BoundedContemplateOutcome,
    BoundedContemplatePreflight, ContemplateRequest, ContextResolution, FamiliarityContext,
    FlowAuthorityRef, FlowContemplateExecutor, FlowContemplateOutcome, FlowContemplatePreflight,
    FlowContemplateRequest, FlowStandingContext, KnowledgeAddress, KnowledgeApplication,
    KnowledgeDependency, KnowledgeExplanation, KnowledgeProviderStatus, KnowledgeReading,
    KnowledgeRelationView, KnowledgeResourceDependency, KnowledgeSearchResult,
    ProjectCentralBinding, ProjectReflectionReadModel, QlRefractionRequest, ResourceRef,
    Result as AikitResult, SemanticWikiIndex, SemanticWikiProvider, WikiObject,
    DEFAULT_CONTEMPLATE_OBJECT_BUDGET, DEFAULT_CONTEMPLATE_RELATION_DEPTH,
    DEFAULT_LIVING_IMPACT_DEPTH, DEFAULT_LIVING_IMPACT_RESOURCES,
};
use aikit_store::{AikitHome, KnowledgeApplicationReceipt, KnowledgeApplicationStore};
use serde::Serialize;
use serde_json::Value;

use crate::living_wiki::{
    adapt_central_horizon, living_wiki_reading, CentralSourceHorizon, LivingWikiDesktopReading,
};
use crate::project_field::{LocalProjectField, ProjectFieldSnapshot};

pub const OI_AUTHORED_RELATIONS_VERSION: &str = "oi.authored-wiki-relations/v1";

#[derive(Debug, Serialize)]
pub struct AuthoredRelationsStatus {
    pub version: &'static str,
    pub provider: &'static str,
    pub sources: usize,
    pub resolved_relations: usize,
    pub pending_relations: usize,
    pub living_dependencies: usize,
    pub semantic_wiki_revision: String,
    pub automatic_agent_or_model_invocation: bool,
}

#[derive(Debug, Serialize)]
pub struct ProjectKnowledgeStatus {
    pub knowledge: KnowledgeProviderStatus,
    pub authored_relations: AuthoredRelationsStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_field: Option<ProjectFieldSnapshot>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_field_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum ProjectReading {
    Knowledge(KnowledgeReading),
    Source(aikit_core::ContextSourceReadOutcome),
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum ProjectExplanation {
    Knowledge(Box<KnowledgeExplanation>),
    Source(Value),
}

/// Keep the established Project reflection shape intact while adding AIKit's
/// source-authored relation reading beside it. `flatten` means existing source
/// relation consumers keep their current fields unchanged.
#[derive(Debug, Serialize)]
pub struct ProjectSourceRelations {
    #[serde(flatten)]
    pub reflection: ProjectReflectionReadModel,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authored: Option<AuthoredWikiSubjectRelations>,
}

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum ProjectRelations {
    Knowledge(KnowledgeRelationView),
    Source(ProjectSourceRelations),
}

pub struct LocalProjectKnowledge {
    binding: ProjectCentralBinding,
    index: SemanticWikiIndex,
    authored_sources: Vec<AuthoredWikiSourceProjection>,
    authored_compilation: AuthoredWikiRelationCompilation,
    authored_dependencies: Vec<KnowledgeDependency>,
    context: FamiliarityContext,
    store: KnowledgeApplicationStore,
    project_field: Mutex<LocalProjectField>,
}

impl LocalProjectKnowledge {
    /// Open using the native AIKit home discovered for this process. Raw actor and
    /// Agency refs are parsed here so the Tauri shell does not need its own AIKit
    /// dependency merely to project the application.
    pub fn discover(
        project_root: impl AsRef<Path>,
        central_root: Option<&Path>,
        actor: Option<&str>,
        agency: Option<&str>,
        focus: Option<String>,
    ) -> AikitResult<Self> {
        Self::open(
            project_root,
            central_root,
            AikitHome::discover()?,
            actor.map(ResourceRef::parse).transpose()?,
            agency.map(ResourceRef::parse).transpose()?,
            focus,
        )
    }

    pub fn open(
        project_root: impl AsRef<Path>,
        central_root: Option<&Path>,
        aikit_home: AikitHome,
        actor: Option<ResourceRef>,
        agency: Option<ResourceRef>,
        focus: Option<String>,
    ) -> AikitResult<Self> {
        let project_root = project_root.as_ref().to_path_buf();
        let binding = ProjectCentralFilesystemBinding::inspect(&project_root, central_root)?;

        // AIKit owns source interpretation. O:I keeps its already-established
        // canonical + explicitly adopted Wiki horizon, then asks the same AIKit
        // compiler to resolve/materialise source-authored relations across it.
        let authored = projectcentral_authored_wiki(&binding)?;
        let authored_sources = authored.source_projections;
        let mut objects = authored.wiki_objects;
        for (_, adopted) in binding.load_adopted_wikis()? {
            objects.extend(adopted);
        }
        let authored_compilation =
            compile_authored_wiki_relations(&authored_sources, &objects, &[])?;
        let index =
            rebuild_semantic_wiki_with_authored_relations(&objects, &authored_compilation)?;
        let authored_dependencies = authored_relation_dependencies(&authored_sources);

        let project = ResourceRef::parse(&binding.semantic.project.to_string())?;
        let context = FamiliarityContext {
            project: Some(project),
            actor,
            agency,
            focus,
        };
        let project_field = LocalProjectField::discover(&project_root, central_root, None)
            .map_err(|error| AikitError::new("oi.project_field.open", error))?;
        Ok(Self {
            binding: binding.semantic,
            index,
            authored_sources,
            authored_compilation,
            authored_dependencies,
            context,
            store: KnowledgeApplicationStore::new(aikit_home),
            project_field: Mutex::new(project_field),
        })
    }

    pub fn project_binding(&self) -> &ProjectCentralBinding {
        &self.binding
    }

    pub fn context(&self) -> &FamiliarityContext {
        &self.context
    }

    pub fn status(&self) -> ProjectKnowledgeStatus {
        let knowledge = self.application().status();
        let authored_relations = AuthoredRelationsStatus {
            version: OI_AUTHORED_RELATIONS_VERSION,
            provider: "ai-kit",
            sources: self.authored_sources.len(),
            resolved_relations: self.authored_compilation.edges.len(),
            pending_relations: self.authored_compilation.pending.len(),
            living_dependencies: self.authored_dependencies.len(),
            semantic_wiki_revision: self.index.revision().to_string(),
            automatic_agent_or_model_invocation: false,
        };
        match self.project_field.lock() {
            Ok(field) => match field.snapshot() {
                Ok(project_field) => ProjectKnowledgeStatus {
                    knowledge,
                    authored_relations,
                    project_field: Some(project_field),
                    project_field_error: None,
                },
                Err(error) => ProjectKnowledgeStatus {
                    knowledge,
                    authored_relations,
                    project_field: None,
                    project_field_error: Some(error),
                },
            },
            Err(_) => ProjectKnowledgeStatus {
                knowledge,
                authored_relations,
                project_field: None,
                project_field_error: Some("Project field lock poisoned".into()),
            },
        }
    }

    /// Compose Central's authoritative source horizon with AIKit's deterministic
    /// Wiki and source-authored dependency closure. This method cannot invoke an
    /// Agent/model.
    pub fn living_status(
        &self,
        central: &CentralSourceHorizon,
    ) -> Result<LivingWikiDesktopReading, String> {
        let horizon = adapt_central_horizon(central)?;
        let current_wiki_objects = self.wiki_objects();
        let (dependencies, resource_dependencies) = self.living_dependencies(&current_wiki_objects)
            .map_err(|error| error.to_string())?;
        let impact = deterministic_transitive_knowledge_impact(
            &horizon,
            &dependencies,
            &resource_dependencies,
            DEFAULT_LIVING_IMPACT_DEPTH,
            DEFAULT_LIVING_IMPACT_RESOURCES,
        )
        .map_err(|error| error.to_string())?;
        let mut reading = living_wiki_reading(central, &self.index)?;
        reading.impact = impact;
        Ok(reading)
    }

    /// AIKit-owned deterministic bounded Contemplate preflight. Runtime identity
    /// is supplied by the native host, never by renderer selection state. O:I adds
    /// only the exact AIKit-authored source dependency basis already materialised
    /// for this Project horizon.
    pub fn living_preflight(
        &self,
        central: &CentralSourceHorizon,
        focus: Vec<ResourceRef>,
        runtime: &ModelRuntimeReadModel,
        ql: Option<QlRefractionRequest>,
    ) -> Result<BoundedContemplatePreflight, String> {
        let horizon = adapt_central_horizon(central)?;
        let current_wiki_objects = self.wiki_objects();
        let (dependencies, resource_dependencies) = self
            .living_dependencies(&current_wiki_objects)
            .map_err(|error| error.to_string())?;
        bounded_contemplate_preflight(
            &ContemplateRequest {
                project: self.binding.project.clone(),
                focus,
                horizon: &horizon,
                dependencies: &dependencies,
                current_wiki_objects: &current_wiki_objects,
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

    /// Deterministic Flow-specialised preflight over this same local Wiki/change
    /// field. AIKit owns Method/Praxis selection and validates that it belongs to
    /// the supplied canonical ContextResolution. O:I adds no prompt-local praxis.
    pub fn flow_preflight(
        &self,
        central: &CentralSourceHorizon,
        standing: &FlowStandingContext,
        context_resolution: &ContextResolution,
        runtime: &ModelRuntimeReadModel,
        authority_refs: &[FlowAuthorityRef],
    ) -> AikitResult<FlowContemplatePreflight> {
        let horizon = adapt_central_horizon(central)
            .map_err(|error| AikitError::new("oi.living_wiki.central_horizon", error))?;
        let current_wiki_objects = self.wiki_objects();
        let (dependencies, resource_dependencies) =
            self.living_dependencies(&current_wiki_objects)?;
        let method = first_party_flow_method(None)?;
        let mut resources = MemoryResourceIndex::default();
        for record in first_party_flow_resource_records()? {
            resources.insert(record);
        }
        let praxis = resolve_praxis(
            context_resolution,
            &resources,
            std::slice::from_ref(&method),
            std::slice::from_ref(&method.id),
            &[],
        );
        if !praxis.warnings.is_empty() {
            return Err(AikitError::new(
                "oi.flow.praxis_unresolved",
                format!(
                    "Flow Method/Praxis did not resolve cleanly: {}",
                    praxis.warnings.join("; ")
                ),
            ));
        }
        let request = ContemplateRequest {
            project: self.binding.project.clone(),
            focus: vec![standing.binding.flow_ref.clone()],
            horizon: &horizon,
            dependencies: &dependencies,
            current_wiki_objects: &current_wiki_objects,
            runtime,
            method: Some(&method),
            ql: None,
        };
        flow_contemplate_preflight(&FlowContemplateRequest::with_defaults(
            standing,
            &request,
            &resource_dependencies,
            &praxis,
            authority_refs,
        ))
    }

    /// Cross the Agent/model line exactly through AIKit's explicit Flow/Living
    /// aperture. Flow mutation intents remain unapplied owner requests in the
    /// returned outcome; the native host decides whether/how to apply them.
    pub fn flow_contemplate(
        &self,
        central: &CentralSourceHorizon,
        standing: &FlowStandingContext,
        context_resolution: &ContextResolution,
        runtime: &ModelRuntimeReadModel,
        authority_refs: &[FlowAuthorityRef],
        executor: &mut dyn FlowContemplateExecutor,
    ) -> AikitResult<FlowContemplateOutcome> {
        let horizon = adapt_central_horizon(central)
            .map_err(|error| AikitError::new("oi.living_wiki.central_horizon", error))?;
        let current_wiki_objects = self.wiki_objects();
        let (dependencies, resource_dependencies) =
            self.living_dependencies(&current_wiki_objects)?;
        let method = first_party_flow_method(None)?;
        let mut resources = MemoryResourceIndex::default();
        for record in first_party_flow_resource_records()? {
            resources.insert(record);
        }
        let praxis = resolve_praxis(
            context_resolution,
            &resources,
            std::slice::from_ref(&method),
            std::slice::from_ref(&method.id),
            &[],
        );
        if !praxis.warnings.is_empty() {
            return Err(AikitError::new(
                "oi.flow.praxis_unresolved",
                format!(
                    "Flow Method/Praxis did not resolve cleanly: {}",
                    praxis.warnings.join("; ")
                ),
            ));
        }
        let request = ContemplateRequest {
            project: self.binding.project.clone(),
            focus: vec![standing.binding.flow_ref.clone()],
            horizon: &horizon,
            dependencies: &dependencies,
            current_wiki_objects: &current_wiki_objects,
            runtime,
            method: Some(&method),
            ql: None,
        };
        explicit_flow_contemplate(
            &FlowContemplateRequest::with_defaults(
                standing,
                &request,
                &resource_dependencies,
                &praxis,
                authority_refs,
            ),
            executor,
        )
    }

    /// Renderer/native-shell facade over the same owner preflight. Strings are
    /// accepted only as transport values and parsed immediately through AIKit's
    /// canonical ResourceRef parser. Ordinary desktop correctness has no QL
    /// requirement; formal profiles remain an explicit owner attachment.
    pub fn living_preflight_refs(
        &self,
        central: &CentralSourceHorizon,
        focus: Vec<String>,
        runtime: &ModelRuntimeReadModel,
    ) -> Result<BoundedContemplatePreflight, String> {
        let focus = parse_resource_refs(focus).map_err(|error| error.to_string())?;
        self.living_preflight(central, focus, runtime, None)
    }

    /// Cross the Agent/model line only when the caller explicitly supplies AIKit's
    /// bounded executor. Human source effects remain proposal-only in AIKit's
    /// returned Agent-Wiki maintenance plan.
    pub fn contemplate(
        &self,
        central: &CentralSourceHorizon,
        focus: Vec<ResourceRef>,
        runtime: &ModelRuntimeReadModel,
        ql: Option<QlRefractionRequest>,
        executor: &mut dyn BoundedContemplateExecutor,
    ) -> AikitResult<BoundedContemplateOutcome> {
        let horizon = adapt_central_horizon(central)
            .map_err(|error| AikitError::new("oi.living_wiki.central_horizon", error))?;
        let current_wiki_objects = self.wiki_objects();
        let (dependencies, resource_dependencies) =
            self.living_dependencies(&current_wiki_objects)?;
        explicit_bounded_contemplate(
            &ContemplateRequest {
                project: self.binding.project.clone(),
                focus,
                horizon: &horizon,
                dependencies: &dependencies,
                current_wiki_objects: &current_wiki_objects,
                runtime,
                method: None,
                ql,
            },
            &resource_dependencies,
            DEFAULT_CONTEMPLATE_OBJECT_BUDGET,
            DEFAULT_CONTEMPLATE_RELATION_DEPTH,
            executor,
        )
    }

    /// Stable-ref transport facade for explicit ordinary Contemplate. The same
    /// ResourceRef parser and owner operation are used as the typed path above.
    pub fn contemplate_refs(
        &self,
        central: &CentralSourceHorizon,
        focus: Vec<String>,
        runtime: &ModelRuntimeReadModel,
        executor: &mut dyn BoundedContemplateExecutor,
    ) -> AikitResult<BoundedContemplateOutcome> {
        self.contemplate(
            central,
            parse_resource_refs(focus)?,
            runtime,
            None,
            executor,
        )
    }

    pub fn search(&self, query: &str, limit: usize) -> AikitResult<KnowledgeSearchResult> {
        let result = self.application().search(query, limit);
        self.store.remember_search_hits(&result.hits)?;
        Ok(result)
    }

    /// Explicit reading preserves the identity of the selected thing. Wiki refs
    /// use the native Knowledge application; ContextSource refs use AIKit's
    /// provider-owned retrieval with a Human target. Selection itself never calls
    /// this method and therefore never becomes retrieval or Agent disclosure.
    pub fn read(&self, raw_resource: &str) -> AikitResult<ProjectReading> {
        if self.project_source_exists(raw_resource)? {
            let mut field = self.project_field()?;
            return field
                .read_source(raw_resource)
                .map(ProjectReading::Source)
                .map_err(|error| AikitError::new("oi.project_source.read", error));
        }
        let address = self.resolve_address(raw_resource)?;
        let application = self.application();
        let reading = application.read(&address)?;
        let route = application.route(None, std::slice::from_ref(&address))?;
        self.store.append_route(route)?;
        Ok(ProjectReading::Knowledge(reading))
    }

    pub fn relations(
        &self,
        raw_resource: &str,
        depth: u8,
        max_nodes: usize,
        max_edges: usize,
    ) -> AikitResult<ProjectRelations> {
        if self.project_source_exists(raw_resource)? {
            let field = self.project_field()?;
            let reflection = field
                .reflection(raw_resource)
                .map_err(|error| AikitError::new("oi.project_reflection.read", error))?;
            return Ok(ProjectRelations::Source(ProjectSourceRelations {
                reflection,
                authored: self.authored_relations(raw_resource)?,
            }));
        }
        let address = self.resolve_address(raw_resource)?;
        self.application()
            .relations(&address, depth, max_nodes, max_edges)
            .map(ProjectRelations::Knowledge)
    }

    /// Shared authored relation/backlink/pending read over AIKit-owned state. The
    /// renderer never sees source bytes and never reparses Markdown/OKF.
    pub fn authored_relations(
        &self,
        raw_resource: &str,
    ) -> AikitResult<Option<AuthoredWikiSubjectRelations>> {
        let Some(source) = self.authored_sources.iter().find(|source| {
            source.source_ref.as_str() == raw_resource || source.subject_ref.as_str() == raw_resource
        }) else {
            return Ok(None);
        };
        let label = source
            .title
            .clone()
            .or_else(|| source.locators.first().cloned())
            .unwrap_or_else(|| source.subject_ref.to_string());
        authored_wiki_subject_relations(
            &self.index,
            &self.authored_compilation,
            source.subject_ref.clone(),
            ResourceKind::KnowledgeSource,
            label,
        )
        .map(Some)
    }

    pub fn explain(&self, raw_resource: &str) -> AikitResult<ProjectExplanation> {
        if self.project_source_exists(raw_resource)? {
            let field = self.project_field()?;
            return field
                .explain_source(raw_resource)
                .map(ProjectExplanation::Source)
                .map_err(|error| AikitError::new("oi.project_source.explain", error));
        }
        let address = self.resolve_address(raw_resource)?;
        self.application()
            .explain(&address)
            .map(Box::new)
            .map(ProjectExplanation::Knowledge)
    }

    pub fn history(
        &self,
        raw_resource: Option<&str>,
    ) -> AikitResult<Vec<KnowledgeApplicationReceipt>> {
        let resource = raw_resource.map(ResourceRef::parse).transpose()?;
        self.store.history(Some(&self.context), resource.as_ref())
    }

    fn wiki_objects(&self) -> Vec<WikiObject> {
        self.index
            .discover()
            .into_iter()
            .filter_map(|resource| self.index.resolve(&resource))
            .collect()
    }

    fn living_dependencies(
        &self,
        current_wiki_objects: &[WikiObject],
    ) -> AikitResult<(Vec<KnowledgeDependency>, Vec<KnowledgeResourceDependency>)> {
        let (mut source_dependencies, resource_dependencies) =
            wiki_living_dependencies(current_wiki_objects)?;
        source_dependencies.extend(self.authored_dependencies.iter().cloned());
        source_dependencies.sort_by(|left, right| {
            left.dependent
                .cmp(&right.dependent)
                .then(left.source.cmp(&right.source))
                .then(left.relation.cmp(&right.relation))
        });
        source_dependencies.dedup_by(|left, right| {
            left.dependent == right.dependent
                && left.source == right.source
                && left.relation == right.relation
                && left.basis_revision == right.basis_revision
        });
        Ok((source_dependencies, resource_dependencies))
    }

    fn application(&self) -> KnowledgeApplication<'_> {
        KnowledgeApplication::new(self.context.clone())
            .with_wiki(SemanticWikiProvider::new(&self.index))
    }

    fn project_field(&self) -> AikitResult<std::sync::MutexGuard<'_, LocalProjectField>> {
        self.project_field
            .lock()
            .map_err(|_| AikitError::new("oi.project_field.lock", "Project field lock poisoned"))
    }

    fn project_source_exists(&self, raw_resource: &str) -> AikitResult<bool> {
        Ok(self.project_field()?.contains_source(raw_resource))
    }

    fn resolve_address(&self, raw_resource: &str) -> AikitResult<KnowledgeAddress> {
        let resource = ResourceRef::parse(raw_resource)?;
        if let Some(address) = self.store.address(&resource)? {
            return Ok(address);
        }
        // Direct stable-ref navigation is allowed only when the derived local
        // index proves the ref is a Wiki object. Search-learned addresses remain
        // preferable because richer native provider identity is retained.
        if self.index.contains(&resource) {
            return Ok(KnowledgeAddress::Wiki(resource));
        }
        Err(AikitError::new(
            "oi.knowledge.address_unknown",
            format!(
                "{raw_resource} is neither a Project ContextSource nor present in the local SemanticWiki index and has not been resolved by Knowledge search"
            ),
        ))
    }
}

fn parse_resource_refs(raw: Vec<String>) -> AikitResult<Vec<ResourceRef>> {
    raw.into_iter()
        .map(|value| ResourceRef::parse(&value))
        .collect()
}
