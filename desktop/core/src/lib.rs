mod bridge;
mod contribution;
mod live_product;
mod local_factory;
mod shell;

pub use bridge::{BridgeCallClass, BridgeCaller, BridgeDenied, BridgePolicy};
pub use contribution::{
    authorize_action, host_native_contribution, selection_for, ActionAuthorityGrant,
    ActionAvailability, CanonicalActionBinding, ContributionAvailability, HostRegion,
    HostedContribution, NativeActionInvocation, NativeContributionReading, PackageEnvelopeRef,
    SelectionProjection,
};
pub use epilogos_factory::build::FactoryBuildSnapshot;
pub use live_product::{
    correlate_session_spaces, dispatch_factory_action, observe_factory_build, FactoryActionRoundTrip,
    FactoryHostObservation, SessionSpaceCorrelation, SessionSpaceCorrelationState,
    SurfaceActionEmission, FACTORY_BUILD_CONTRIBUTION_REF,
};
pub use local_factory::{host_factory_snapshot, LocalFactoryHost};
pub use shell::{
    DesktopHost, RefProvenance, SemanticRef, ShellDestination, ShellSnapshot, SuiteCondition,
};
