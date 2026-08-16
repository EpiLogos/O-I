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
    resolve_skillset, write_direct_projection, AgentScope, AuthoritativeSkillRef,
    DirectProjectionReceipt, EffectiveSkill, EffectiveSkillSet, SkillProfile, SkillProjectionMode,
    SkillSource, SuiteSkillSetManifest,
};
