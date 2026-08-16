mod bridge;
mod contribution;
mod shell;
mod skillset;

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
pub use skillset::{
    remove_direct_projection, resolve_skillset, write_direct_projection,
    write_direct_projection_with_state, AgentScope, AuthoritativeSkillRef, DirectProjectionReceipt,
    DirectProjectionUpdate, EffectiveSkill, EffectiveSkillSet, ExpectedNativeSkill,
    NativeSkillPublicationState, SkillProfile, SkillProjectionMode, SkillSource,
    SuiteSkillSetManifest,
};
