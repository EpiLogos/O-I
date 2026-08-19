//! Local/private Knowledge workbench over ProjectCentral + AIKit Knowledge.
//!
//! ProjectCentral remains the source owner and SemanticWiki remains the relation
//! authority. O:I rebuilds AIKit's derived index for navigation and records only
//! AIKit-owned route/history receipts. The Central root Human Wiki is deliberately
//! not loaded by this default binding: local retrievability is bounded and does
//! not imply ambient disclosure, Projection, or publication.

use std::path::Path;

use aikit_adapters::ProjectCentralFilesystemBinding;
use aikit_core::{
    FamiliarityContext, KnowledgeAddress, KnowledgeApplication, KnowledgeExplanation,
    KnowledgeProviderStatus, KnowledgeReading, KnowledgeRelationView, KnowledgeSearchResult,
    ProjectCentralBinding, ResourceRef, Result as AikitResult, SemanticWikiIndex,
    SemanticWikiProvider,
};
use aikit_store::{AikitHome, KnowledgeApplicationReceipt, KnowledgeApplicationStore};

#[derive(Debug, Clone)]
pub struct LocalProjectKnowledge {
    binding: ProjectCentralBinding,
    index: SemanticWikiIndex,
    context: FamiliarityContext,
    store: KnowledgeApplicationStore,
}

impl LocalProjectKnowledge {
    pub fn open(
        project_root: impl AsRef<Path>,
        central_root: Option<&Path>,
        aikit_home: AikitHome,
        actor: Option<ResourceRef>,
        agency: Option<ResourceRef>,
        focus: Option<String>,
    ) -> AikitResult<Self> {
        let binding = ProjectCentralFilesystemBinding::inspect(project_root, central_root)?;

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
        Ok(Self {
            binding: binding.semantic,
            index,
            context,
            store: KnowledgeApplicationStore::new(aikit_home),
        })
    }

    pub fn project_binding(&self) -> &ProjectCentralBinding {
        &self.binding
    }

    pub fn context(&self) -> &FamiliarityContext {
        &self.context
    }

    pub fn status(&self) -> KnowledgeProviderStatus {
        self.application().status()
    }

    pub fn search(&self, query: &str, limit: usize) -> AikitResult<KnowledgeSearchResult> {
        let result = self.application().search(query, limit);
        self.store.remember_search_hits(&result.hits)?;
        Ok(result)
    }

    pub fn read(&self, raw_resource: &str) -> AikitResult<KnowledgeReading> {
        let address = self.resolve_address(raw_resource)?;
        let application = self.application();
        let reading = application.read(&address)?;
        let route = application.route(None, std::slice::from_ref(&address))?;
        self.store.append_route(route)?;
        Ok(reading)
    }

    pub fn relations(
        &self,
        raw_resource: &str,
        depth: u8,
        max_nodes: usize,
        max_edges: usize,
    ) -> AikitResult<KnowledgeRelationView> {
        let address = self.resolve_address(raw_resource)?;
        self.application()
            .relations(&address, depth, max_nodes, max_edges)
    }

    pub fn explain(&self, raw_resource: &str) -> AikitResult<KnowledgeExplanation> {
        let address = self.resolve_address(raw_resource)?;
        self.application().explain(&address)
    }

    pub fn history(
        &self,
        raw_resource: Option<&str>,
    ) -> AikitResult<Vec<KnowledgeApplicationReceipt>> {
        let resource = raw_resource.map(ResourceRef::parse).transpose()?;
        self.store.history(Some(&self.context), resource.as_ref())
    }

    fn application(&self) -> KnowledgeApplication<'_> {
        KnowledgeApplication::new(self.context.clone())
            .with_wiki(SemanticWikiProvider::new(&self.index))
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
        Err(aikit_core::AikitError::new(
            "oi.knowledge.address_unknown",
            format!(
                "{raw_resource} is not present in the local SemanticWiki index and has not been resolved by Knowledge search"
            ),
        ))
    }
}
