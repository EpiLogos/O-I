from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual < count:
        raise SystemExit(f"anchor missing in {path}: expected {count}, got {actual}: {old[:120]!r}")
    p.write_text(text.replace(old, new, count))

# Reuse one ACP signal collector for Living and Flow contemplation.
living = "desktop/core/src/living_contemplate.rs"
replace(
    living,
    '''        let prompt = contemplate_prompt(preflight)?;
        let signals = self
            .surface
            .send(&prompt)
            .map_err(|error| AikitError::new("oi.living_contemplate.transport", error))?;

        let mut response = String::new();
        let mut completed = false;
        for signal in signals {
            match signal.kind {
                ConnectionSignalKind::AgentMessageChunk { text } => response.push_str(&text),
                ConnectionSignalKind::Status { .. } => {}
                ConnectionSignalKind::Completed { .. } => completed = true,
                ConnectionSignalKind::Cancelled => {
                    return Err(AikitError::new(
                        "oi.living_contemplate.cancelled",
                        "ACP Contemplate turn was cancelled before a structured AIKit return",
                    ))
                }
                ConnectionSignalKind::Degraded { degradation } => {
                    return Err(AikitError::new(
                        "oi.living_contemplate.degraded",
                        format!("ACP Contemplate provider degraded: {}", degradation.reason),
                    ))
                }
                ConnectionSignalKind::PermissionRequested { .. } => {
                    return Err(AikitError::new(
                        "oi.living_contemplate.permission_required",
                        "ACP Contemplate requested native permission; O:I will not silently grant transport-native authority",
                    ))
                }
                ConnectionSignalKind::ToolCall { .. } | ConnectionSignalKind::ToolResult { .. } => {
                    return Err(AikitError::new(
                        "oi.living_contemplate.unhandled_tool",
                        "ACP Contemplate emitted a tool interaction without an explicit host-owned tool execution relation",
                    ))
                }
                ConnectionSignalKind::SessionOpened { .. } => {
                    return Err(AikitError::new(
                        "oi.living_contemplate.protocol_drift",
                        "ACP Contemplate turn unexpectedly opened a second AgentSession",
                    ))
                }
            }
        }

        if !completed {
            return Err(AikitError::new(
                "oi.living_contemplate.incomplete",
                "ACP Contemplate turn ended without a Completed signal",
            ));
        }
        if response.trim().is_empty() {
            return Err(AikitError::new(
                "oi.living_contemplate.empty_return",
                "ACP Contemplate completed without an Agent message to validate",
            ));
        }

        // Knowledge shape, Wiki validation, integrative basis/Return validation and
        // human-source proposal authority all remain AIKit-owned here.
        parse_contemplate_generated(&response)
''',
    '''        let prompt = contemplate_prompt(preflight)?;
        let response = send_structured_agent_turn(self.surface, &prompt, "Living Knowledge Contemplate")?;

        // Knowledge shape, Wiki validation, integrative basis/Return validation and
        // human-source proposal authority all remain AIKit-owned here.
        parse_contemplate_generated(&response)
''')
insert_anchor = '''pub fn contemplate_prompt(preflight: &BoundedContemplatePreflight) -> AikitResult<String> {'''
helper = r'''pub(crate) fn send_structured_agent_turn(
    surface: &mut AikitAgentSurface,
    prompt: &str,
    operation: &str,
) -> AikitResult<String> {
    let signals = surface
        .send(prompt)
        .map_err(|error| AikitError::new("oi.living_contemplate.transport", error))?;
    let mut response = String::new();
    let mut completed = false;
    for signal in signals {
        match signal.kind {
            ConnectionSignalKind::AgentMessageChunk { text } => response.push_str(&text),
            ConnectionSignalKind::Status { .. } => {}
            ConnectionSignalKind::Completed { .. } => completed = true,
            ConnectionSignalKind::Cancelled => {
                return Err(AikitError::new(
                    "oi.living_contemplate.cancelled",
                    format!("ACP {operation} turn was cancelled before a structured AIKit return"),
                ))
            }
            ConnectionSignalKind::Degraded { degradation } => {
                return Err(AikitError::new(
                    "oi.living_contemplate.degraded",
                    format!("ACP {operation} provider degraded: {}", degradation.reason),
                ))
            }
            ConnectionSignalKind::PermissionRequested { .. } => {
                return Err(AikitError::new(
                    "oi.living_contemplate.permission_required",
                    format!("ACP {operation} requested native permission; O:I will not silently grant transport-native authority"),
                ))
            }
            ConnectionSignalKind::ToolCall { .. } | ConnectionSignalKind::ToolResult { .. } => {
                return Err(AikitError::new(
                    "oi.living_contemplate.unhandled_tool",
                    format!("ACP {operation} emitted a tool interaction without an explicit host-owned tool execution relation"),
                ))
            }
            ConnectionSignalKind::SessionOpened { .. } => {
                return Err(AikitError::new(
                    "oi.living_contemplate.protocol_drift",
                    format!("ACP {operation} turn unexpectedly opened a second AgentSession"),
                ))
            }
        }
    }
    if !completed {
        return Err(AikitError::new(
            "oi.living_contemplate.incomplete",
            format!("ACP {operation} turn ended without a Completed signal"),
        ));
    }
    if response.trim().is_empty() {
        return Err(AikitError::new(
            "oi.living_contemplate.empty_return",
            format!("ACP {operation} completed without an Agent message to validate"),
        ));
    }
    Ok(response)
}

'''
replace(living, insert_anchor, helper + insert_anchor)

# LocalProjectKnowledge composes current Flow Method/Praxis over the existing Wiki/change field.
pk = "desktop/core/src/project_knowledge.rs"
replace(
    pk,
    '''    explicit_bounded_contemplate, wiki_living_dependencies, AikitError,
    BoundedContemplateExecutor, BoundedContemplateOutcome, BoundedContemplatePreflight,
    ContemplateRequest, FamiliarityContext, KnowledgeAddress, KnowledgeApplication,
    KnowledgeExplanation, KnowledgeProviderStatus, KnowledgeReading, KnowledgeRelationView,
    KnowledgeSearchResult, ProjectCentralBinding, ProjectReflectionReadModel, QlRefractionRequest,
    ResourceRef, Result as AikitResult, SemanticWikiIndex, SemanticWikiProvider, WikiObject,
    DEFAULT_CONTEMPLATE_OBJECT_BUDGET, DEFAULT_CONTEMPLATE_RELATION_DEPTH,
''',
    '''    explicit_bounded_contemplate, explicit_flow_contemplate, first_party_flow_method,
    first_party_flow_resource_records, flow_contemplate_preflight, resolve_praxis,
    wiki_living_dependencies, AikitError, BoundedContemplateExecutor, BoundedContemplateOutcome,
    BoundedContemplatePreflight, ContemplateRequest, ContextResolution, FamiliarityContext,
    FlowAuthorityRef, FlowContemplateExecutor, FlowContemplateOutcome, FlowContemplatePreflight,
    FlowContemplateRequest, FlowStandingContext, KnowledgeAddress, KnowledgeApplication,
    KnowledgeExplanation, KnowledgeProviderStatus, KnowledgeReading, KnowledgeRelationView,
    KnowledgeSearchResult, MemoryResourceIndex, ProjectCentralBinding, ProjectReflectionReadModel,
    QlRefractionRequest, ResourceRef, Result as AikitResult, SemanticWikiIndex,
    SemanticWikiProvider, WikiObject, DEFAULT_CONTEMPLATE_OBJECT_BUDGET,
    DEFAULT_CONTEMPLATE_RELATION_DEPTH,
''')
method_anchor = '''    /// Renderer/native-shell facade over the same owner preflight. Strings are
    /// accepted only as transport values and parsed immediately through AIKit's
    /// canonical ResourceRef parser. Ordinary desktop correctness has no QL
    /// requirement; formal profiles remain an explicit owner attachment.
'''
flow_methods = r'''    /// Deterministic Flow-specialised preflight over this same local Wiki/change
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
        let (dependencies, resource_dependencies) = wiki_living_dependencies(&current_wiki_objects)?;
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
                format!("Flow Method/Praxis did not resolve cleanly: {}", praxis.warnings.join("; ")),
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
        let (dependencies, resource_dependencies) = wiki_living_dependencies(&current_wiki_objects)?;
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
                format!("Flow Method/Praxis did not resolve cleanly: {}", praxis.warnings.join("; ")),
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

'''
replace(pk, method_anchor, flow_methods + method_anchor)

# Public desktop-core composition.
lib = "desktop/core/src/lib.rs"
replace(lib, "mod execution_authority;\nmod live_product;", "mod execution_authority;\nmod flow;\nmod flow_contemplate;\nmod live_product;")
replace(
    lib,
    '''pub use execution_authority::{
    ActionAuthorityStore, ActionExecutionRequest, AuthorisedActionExecution, BoundedActionGrant,
    BOUNDED_ACTION_GRANT_SCHEMA,
};
''',
    '''pub use execution_authority::{
    ActionAuthorityStore, ActionExecutionRequest, AuthorisedActionExecution, BoundedActionGrant,
    BOUNDED_ACTION_GRANT_SCHEMA,
};
pub use flow::{
    CentralFlowClient, CentralFlowList, CentralFlowReading, CentralFlowRecord,
    CentralFlowRevisionReceipt, FlowDesktopSnapshot, FlowDocumentReading,
    CENTRAL_FLOW_PROVIDER_REF, OI_FLOW_DESKTOP_VERSION,
};
pub use flow_contemplate::{
    flow_contemplate_prompt, AcpFlowContemplateExecutor, FLOW_CONTEMPLATE_TRANSPORT_VERSION,
};
''')

# Bridge policy names the new owner operations without changing contribution authority.
bridge = "desktop/core/src/bridge.rs"
replace(
    bridge,
    '''    ObserveKnowledge,
    ContemplateKnowledge,
    SelectSemanticRef,''',
    '''    ObserveKnowledge,
    ObserveFlow,
    MutateFlow,
    ContemplateKnowledge,
    ContemplateFlow,
    SelectSemanticRef,''')
replace(bridge, "pub const ALL: [Self; 12]", "pub const ALL: [Self; 15]")
replace(
    bridge,
    '''        Self::ObserveKnowledge,
        Self::ContemplateKnowledge,
        Self::SelectSemanticRef,''',
    '''        Self::ObserveKnowledge,
        Self::ObserveFlow,
        Self::MutateFlow,
        Self::ContemplateKnowledge,
        Self::ContemplateFlow,
        Self::SelectSemanticRef,''')

Path("scripts/apply-flow-138-core.py").unlink()
Path(".github/workflows/flow-138-core.yml").unlink()
