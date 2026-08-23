//! Local/private Project work field over ProjectCentral + AIKit Knowledge.
//!
//! ProjectCentral remains source/ground authority and SemanticWiki remains Wiki
//! relation authority. O:I composes their native AIKit readings; it does not own
//! source identity, Project identity, Wiki state, ProjectMap graph state, or Agent
//! Context disclosure. Stable selection remains a separate host concern.

use std::path::Path;
use std::sync::Mutex;

use aikit_adapters::ProjectCentralFilesystemBinding;
use aikit_core::model_runtime::ModelRuntimeReadModel;
use aikit_core::{
    explicit_bounded_contemplate, wiki_living_dependencies, AikitError,
    BoundedContemplateExecutor, BoundedContemplateOutcome, BoundedContemplatePreflight,
    ContemplateRequest, FamiliarityContext, KnowledgeAddress, KnowledgeApplication,
    KnowledgeExplanation, KnowledgeProviderStatus, KnowledgeReading, KnowledgeRelationView,
    KnowledgeSearchResult, ProjectCentralBinding, ProjectReflectionReadModel, QlRefractionRequest,
    ResourceRef, Result as AikitResult, SemanticWikiIndex, SemanticWikiProvider, WikiObject,
    DEFAULT_CONTEMPLATE_OBJECT_BUDGET, DEFAULT_CONTEMPLATE_RELATION_DEPTH,
};
use aikit_store::{AikitHome, KnowledgeApplicationReceipt, KnowledgeApplicationStore};
use serde::Serialize;
use serde_json::Value;

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

        // Canonical project Wiki plus explicitly adopted Wikis form the default
        // local project horizon. The optional Central root Wiki is not ambiently
        // loaded; a caller must open it through an explicit source/context path.
        let mut objects = binding.load_project_wiki()?;
        for (_, adopted) in binding.load_adopted_wikis()? {
            objects.extend(adopted);
        }
        let index = SemanticWikiIndex::rebuild(objects)?;
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

    /// Compose Central's authoritative source horizon with AIKit's deterministic
    /// impact/freshness closure. This method cannot invoke an Agent/model.
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
        let (dependencies, resource_dependencies) = wiki_living_dependencies(&current_wiki_objects)?;
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
    raw.into_iter().map(ResourceRef::parse).collect()
}
