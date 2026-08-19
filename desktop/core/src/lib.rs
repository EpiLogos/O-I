mod bridge;
mod contribution;
mod execution_authority;
mod live_product;
mod local_aikit;
mod local_central;
mod local_epi;
mod local_epi_cosmic;
mod local_factory;
mod shell;

pub use bridge::{BridgeCallClass, BridgeCaller, BridgeDenied, BridgePolicy};
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
pub use local_aikit::{
    host_session_space_read_model, AikitSessionSpaceHostObservation, LocalAikitSessionSpaceHost,
    AIKIT_SESSION_SPACE_CONTRIBUTION_REF,
};
pub use local_central::{
    LocalCentralHost, CENTRAL_NOW_INSPECT_ACTION_REF, CENTRAL_NOW_PROMOTE_ACTION_REF,
    CENTRAL_NOW_RETURN_ACTION_REF, CENTRAL_NOW_UPDATE_ACTION_REF,
};
pub use local_epi::{
    host_epi_snapshot, EpiHostObservation, LocalEpiHost, EPI_ANUTTARA_GROUND_ACTION_REF,
    EPI_ANUTTARA_GROUND_CAPABILITY_REF, EPI_ANUTTARA_GROUND_SCHEMA,
    EPI_COSMIC_CONTRIBUTION_REF, EPI_COSMIC_CURRENT_PROVIDER_CONTRACT,
    EPI_COSMIC_CURRENT_SCHEMA, EPI_COSMIC_OPEN_DEPTH_ACTION_REF,
    EPI_COSMIC_OPEN_DEPTH_CAPABILITY_REF, EPI_EPII_REVIEW_ACTION_REF,
    EPI_EPII_REVIEW_CAPABILITY_REF, EPI_EPII_REVIEW_SCHEMA,
    EPI_NARA_DAILY_PROVIDER_CONTRACT, EPI_NARA_DAILY_SCHEMA, EPI_NARA_SELECTION_SCHEMA,
    EPI_NARA_SENDOFF_ACTION_REF, EPI_NARA_SENDOFF_CAPABILITY_REF, EPI_NATIVE_OWNER,
    EPI_PERSONAL_PROPOSAL_ACTION_REF, EPI_PERSONAL_PROPOSAL_CAPABILITY_REF,
    EPI_PERSONAL_PROPOSAL_SCHEMA, EPI_PRIMITIVE_CONTRIBUTION_REF,
    EPI_PRIMITIVE_PROVIDER_CONTRACT, EPI_PRIMITIVE_SNAPSHOT_SCHEMA,
};
pub use local_epi_cosmic::{host_epi_cosmic, EpiCosmicHostObservation};
pub use local_factory::{host_factory_snapshot, LocalFactoryHost};
pub use shell::{
    DesktopHost, RefProvenance, SemanticRef, ShellDestination, ShellSnapshot, SuiteCondition,
};
