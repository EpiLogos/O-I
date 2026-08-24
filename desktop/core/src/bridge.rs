use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BridgeCaller {
    ShellUi,
    SandboxedContribution,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BridgeCallClass {
    DiscloseComposition,
    DiscloseContributions,
    ObserveFactoryBuild,
    DispatchFactoryAction,
    ObserveSessionSpace,
    ObserveContextResolution,
    MutateSessionSpaceFocus,
    InteractAgentSession,
    ObserveKnowledge,
    ObserveFlow,
    MutateFlow,
    ContemplateKnowledge,
    ContemplateFlow,
    SelectSemanticRef,
    OpenDestination,
}

impl BridgeCallClass {
    pub const ALL: [Self; 15] = [
        Self::DiscloseComposition,
        Self::DiscloseContributions,
        Self::ObserveFactoryBuild,
        Self::DispatchFactoryAction,
        Self::ObserveSessionSpace,
        Self::ObserveContextResolution,
        Self::MutateSessionSpaceFocus,
        Self::InteractAgentSession,
        Self::ObserveKnowledge,
        Self::ObserveFlow,
        Self::MutateFlow,
        Self::ContemplateKnowledge,
        Self::ContemplateFlow,
        Self::SelectSemanticRef,
        Self::OpenDestination,
    ];
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BridgeDenied {
    pub caller: BridgeCaller,
    pub call: BridgeCallClass,
}

impl fmt::Display for BridgeDenied {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "bridge caller {:?} is not authorised for {:?}",
            self.caller, self.call
        )
    }
}

impl std::error::Error for BridgeDenied {}

/// Root-shell bridge policy. Third-party/rich contributions are currently hosted
/// only as declarative read models. They are never loaded as code into this
/// privileged caller boundary and therefore receive no bridge authority merely
/// by being present in a Surface catalog.
#[derive(Clone, Copy, Debug, Default)]
pub struct BridgePolicy;

impl BridgePolicy {
    pub fn authorize(
        &self,
        caller: BridgeCaller,
        call: BridgeCallClass,
    ) -> Result<(), BridgeDenied> {
        match caller {
            BridgeCaller::ShellUi => Ok(()),
            BridgeCaller::SandboxedContribution => Err(BridgeDenied { caller, call }),
        }
    }
}
