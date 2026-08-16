mod bridge;
mod contribution;
mod shell;

pub use bridge::{BridgeCallClass, BridgeCaller, BridgeDenied, BridgePolicy};
pub use contribution::{
    authorize_action, host_native_contribution, selection_for, ActionAuthorityGrant,
    ActionAvailability, CanonicalActionBinding, ContributionAvailability, HostRegion,
    HostedContribution, NativeActionInvocation, NativeContributionReading, PackageEnvelopeRef,
    SelectionProjection,
};
pub use shell::{
    DesktopHost, RefProvenance, SemanticRef, ShellDestination, ShellSnapshot, SuiteCondition,
};
