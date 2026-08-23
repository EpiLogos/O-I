mod agent_surface;
mod aikit_workbench;
mod bridge;
mod central_change;
mod contribution;
mod execution_authority;
mod live_product;
mod living_wiki;
mod local_aikit;
mod local_factory;
mod native_application;
mod project_field;
mod project_knowledge;
mod shell;

pub use agent_surface::{AgentSurfaceOpenRequest, AgentSurfaceReading, AikitAgentSurface};
pub use aikit_workbench::{
    LocalAikitWorkbench, SessionSpaceApplicationReading, SessionSpaceFocusRequest,
};
pub use bridge::{BridgeCallClass, BridgeCaller, BridgeDenied, BridgePolicy};
pub use central_change::read_central_change_horizon;
pub use contribution::{
    authorize_action, host_native_contribution, selection_for, ActionAuthorityGrant,
    ActionAvailability, CanonicalActionBinding, ContributionAvailability, HostRegion,
    HostedContribution, NativeActionInvocation, NativeContributionReading, PackageEnvelopeRef,
    SelectionProjection,
};
pub use execution_authority::{
    ActionAuthorityStore, ActionExecutionRequest, AuthorisedActionExecution, BoundedActionGrant,
    BOUNDED_ACTION_GRANT_SCHEMA,
};
pub use epilogos_factory::build::FactoryBuildSnapshot;
pub use live_product::{
    correlate_session_spaces, dispatch_factory_action, observe_factory_build, FactoryActionRoundTrip,
    FactoryHostObservation, SessionSpaceCorrelation, SessionSpaceCorrelationState,
    SurfaceActionEmission, FACTORY_BUILD_CONTRIBUTION_REF,
};
pub use living_wiki::{
    adapt_central_horizon, living_wiki_preflight, living_wiki_reading, parse_central_horizon,
    wiki_dependency_manifest, CentralSourceHorizon, LivingWikiDesktopReading,
    LIVING_WIKI_DESKTOP_VERSION,
};
pub use local_aikit::{
    host_session_space_read_model, AikitSessionSpaceHostObservation, LocalAikitSessionSpaceHost,
    AIKIT_SESSION_SPACE_CONTRIBUTION_REF,
};
pub use local_factory::{host_factory_snapshot, LocalFactoryHost};
pub use native_application::{load_context_resolution, NativeContextResolution};
pub use project_field::{
    LocalProjectField, NativeOwnerReading, ProjectFieldSnapshot, ProjectMapStatus,
    PROJECT_FIELD_VERSION,
};
pub use project_knowledge::LocalProjectKnowledge;
pub use shell::{
    DesktopHost, RefProvenance, SemanticRef, ShellDestination, ShellSnapshot, SuiteCondition,
};
