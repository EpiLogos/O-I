//! Local/private Project work field over ProjectCentral + AIKit Knowledge.
//!
//! ProjectCentral remains source/ground authority and SemanticWiki remains Wiki
//! relation authority. O:I composes their native AIKit readings; it does not own
//! source identity, Project identity, Wiki state, ProjectMap graph state, authored
//! relation parsing/resolution, or Agent Context disclosure. Stable selection
//! remains a separate host concern.

use std::path::Path;
use std::sync::Mutex;

use aikit_adapters::{
    authored_wiki_subject_relations, compile_authored_wiki_relations,
    parse_authored_wiki_source, projectcentral_authored_wiki,
    rebuild_semantic_wiki_with_authored_relations, AuthoredWikiRelationCompilation,
    AuthoredWikiSourceProjection, AuthoredWikiSubjectRelations, ProjectCentralFilesystemBinding,
};
use aikit_core::model_runtime::ModelRuntimeReadModel;
use aikit_core::resource::MemoryResourceIndex;
use aikit_core::{
    explicit_bounded_contemplate, explicit_flow_contemplate, first_party_flow_method,
    first_party_flow_resource_records, flow_contemplate_preflight, resolve_praxis,
    wiki_living_dependencies, AikitError, BoundedContemplateExecutor, BoundedContemplateOutcome,
    BoundedContemplatePreflight, ContemplateRequest, ContextResolution, FamiliarityContext,
    FlowAuthorityRef, FlowContemplateExecutor, FlowContemplateOutcome, FlowContemplatePreflight,
    FlowContemplateRequest, FlowStandingContext, KnowledgeAddress, KnowledgeApplication,
    KnowledgeExplanation, KnowledgeProviderStatus, KnowledgeReading, KnowledgeRelationView,
    KnowledgeSearchResult, ProjectCentralBinding, ProjectReflectionReadModel, QlRefractionRequest,
    ResourceKind, ResourceRef, Result as AikitResult, SemanticWikiIndex, SemanticWikiProvider,
    SourceRef, SourceRevision, WikiObject, DEFAULT_CONTEMPLATE_OBJECT_BUDGET,
    DEFAULT_CONTEMPLATE_RELATION_DEPTH,
};
use aikit_store::{AikitHome, KnowledgeApplicationReceipt, KnowledgeApplicationStore};
use serde::Serialize;
use serde_json::Value;

use crate::flow::FlowDocumentReading;
use crate::living_wiki::{
    adapt_central_horizon, living_wiki_preflight, living_wiki_reading, CentralSourceHorizon,
    LivingWikiDesktopReading,
};
use crate::project_field::{LocalProjectField, ProjectFieldSnapshot};

#[derive(Debug, Serialize)]
pub struct ProjectKnowledgeStatus {
    pub knowledge: KnowledgeProviderStatus,
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

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum ProjectRelations {
    Knowledge(KnowledgeRelationView),
    Reflection(ProjectReflectionReadModel),
}

pub struct LocalProjectKnowledge {
    binding: ProjectCentralBinding,
    /// Canonical/adopted Wiki objects before source-authored relation projection.
    /// This basis is retained so a current Flow can be projected transiently into
    /// the same relation field without recompiling already-compiled edges.
    base_wiki_objects: Vec<WikiObject>,
    authored_sources: Vec<AuthoredWikiSourceProjection>,
    authored_compilation: AuthoredWikiRelationCompilation,
    index: SemanticWikiIndex,
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

        // AIKit owns the source-authored relation compiler. O:I supplies the real
        // ProjectCentral source world, then extends the canonical Wiki basis with
        // explicitly adopted Wikis before performing one final deterministic
        // compile/rebuild so targets in adopted worlds can resolve too.
        let projected = projectcentral_authored_wiki(&binding)?;
        let mut base_wiki_objects = projected.wiki_objects;
        for (_, adopted) in binding.load_adopted_wikis()? {
            base_wiki_objects.extend(adopted);
        }
        let authored_sources = projected.source_projections;
        let authored_compilation =
            compile_authored_wiki_relations(&authored_sources, &base_wiki_objects, &[])?;
        let index = rebuild_semantic_wiki_with_authored_relations(
            &base_wiki_objects,
            &authored_compilation,
        )?;

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
            base_wiki_objects,
            authored_sources,
            authored_compilation,
            index,
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
        match self.project_field.lock() {
            Ok(field) => match field.snapshot() {
                Ok(project_field) => ProjectKnowledgeStatus {
                    knowledge,
                    project_field: Some(project_field),
                    project_field_error: None,
                },
                Err(error) => ProjectKnowledgeStatus {
                    knowledge,
                    project_field: None,
                    project_field_error: Some(error),
                },
            },
            Err(_) => ProjectKnowledgeStatus {
                knowledge,
                project_field: None,
                project_field_error: Some("Project field lock poisoned".into()),
            },
        }
    }

    /// Shared authored relation read for a stable Project source/Wiki subject.
    /// Resolved outgoing/incoming relations come from AIKit's existing
    /// SemanticWikiProvider; unresolved/ambiguous source addresses remain beside
    /// them as pending authored evidence. O:I performs no Markdown parsing here.
    pub fn authored_relations(
        &self,
        raw_resource: &str,
    ) -> AikitResult<AuthoredWikiSubjectRelations> {
        let resource = ResourceRef::parse(raw_resource)?;
        let (kind, label) = self.subject_presentation(&resource)?;
        authored_wiki_subject_relations(
            &self.index,
            &self.authored_compilation,
            resource,
            kind,
            label,
        )
    }

    /// Project the currently-open ordinary Flow body into the same accepted AIKit
    /// relation field. The Flow source is treated conservatively as Observed here:
    /// source role and individual revision actors remain distinct, and O:I does not
    /// manufacture a whole-source human/Agent epistemic standing from UI history.
    /// The projection is read-only, deterministic and never promotes Flow to a
    /// canonical Wiki object.
    pub fn flow_authored_relations(
        &self,
        document: &FlowDocumentReading,
    ) -> AikitResult<AuthoredWikiSubjectRelations> {
        let flow_ref = ResourceRef::parse(&document.flow.flow_ref)?;
        let source_ref = SourceRef::parse(&document.flow.source_ref)?;
        let revision = SourceRevision::parse(&document.flow.current_revision)?;
        let flow_source = parse_authored_wiki_source(
            flow_ref.clone(),
            source_ref.clone(),
            Some(revision),
            vec![document.flow.path.clone()],
            &document.content,
        )?;

        let mut sources = self
            .authored_sources
            .iter()
            .filter(|source| source.source_ref != source_ref)
            .cloned()
            .collect::<Vec<_>>();
        sources.push(flow_source);
        let compilation =
            compile_authored_wiki_relations(&sources, &self.base_wiki_objects, &[])?;
        let index = rebuild_semantic_wiki_with_authored_relations(
            &self.base_wiki_objects,
            &compilation,
        )?;
        authored_wiki_subject_relations(
            &index,
            &compilation,
            flow_ref,
            ResourceKind::ContextSource,
            document
                .flow
                .title
                .clone()
                .unwrap_or_else(|| document.flow.path.clone()),
        )
    }

    /// Compose Central's authoritative source horizon with AIKit's deterministic
    /// impact/freshness closure. The index already includes source-authored edges,
    /// so their exact source provenance participates in the existing Wiki living
    /// dependency derivation. This method cannot invoke an Agent/model.
    pub fn living_status(
        &self,
        central: &CentralSourceHorizon,
    ) -> Result<LivingWikiDesktopReading, String> {
        living_wiki_reading(central, &self.index)
    }

    /// AIKit-owned deterministic bounded Contemplate preflight. Runtime identity
    /// is supplied by the native host, never by renderer selection state. O:I does
    /// not rebuild or enlarge the owner field.
    pub fn living_preflight(
        &self,
        central: &CentralSourceHorizon,
        focus: Vec<ResourceRef>,
        runtime: &ModelRuntimeReadModel,
        ql: Option<QlRefractionRequest>,
    ) -> Result<BoundedContemplatePreflight, String> {
        living_wiki_preflight(
            self.binding.project.clone(),
            focus,
            central,
            &self.index,
            runtime,
            ql,
        )
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
            wiki_living_dependencies(&current_wiki_objects)?;
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
            wiki_living_dependencies(&current_wiki_objects)?;
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
            wiki_living_dependencies(&current_wiki_objects)?;
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
            return field
                .reflection(raw_resource)
                .map(ProjectRelations::Reflection)
                .map_err(|error| AikitError::new("oi.project_reflection.read", error));
        }
        let address = self.resolve_address(raw_resource)?;
        self.application()
            .relations(&address, depth, max_nodes, max_edges)
            .map(ProjectRelations::Knowledge)
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

    fn subject_presentation(&self, resource: &ResourceRef) -> AikitResult<(ResourceKind, String)> {
        if let Some(source) = self
            .binding
            .sources
            .iter()
            .find(|source| source.source.as_str() == resource.as_str())
        {
            return Ok((
                ResourceKind::KnowledgeSource,
                source.relative_path.display().to_string(),
            ));
        }
        if let Some(object) = self.index.resolve(resource) {
            let kind = match object {
                WikiObject::Space(_) => ResourceKind::KnowledgeSpace,
                WikiObject::Frame(_) => ResourceKind::KnowledgeFrame,
                _ => ResourceKind::KnowledgeNode,
            };
            let label = match object {
                WikiObject::Space(value) => value.title.unwrap_or_else(|| resource.to_string()),
                WikiObject::Node(value) => value.title.unwrap_or_else(|| resource.to_string()),
                WikiObject::Edge(value) => value.relation,
                WikiObject::Frame(_) => resource.to_string(),
                WikiObject::Reading(value) => value.reading_type,
            };
            return Ok((kind, label));
        }
        if !self.index.neighbours(resource, 1).is_empty() {
            return Ok((ResourceKind::ContextSource, resource.to_string()));
        }
        Err(AikitError::new(
            "oi.authored_relations.subject_unknown",
            format!("{resource} is not present in the current Project relation field"),
        ))
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
