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
    MutateSessionSpaceFocus,
    InteractAgentSession,
    ObserveKnowledge,
    ObserveEpiPersonal,
    WriteEpiNara,
    DispatchEpiNaraAction,
    DispatchEpiPersonalAction,
    ObserveCentralNow,
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
        Self::MutateSessionSpaceFocus,
        Self::InteractAgentSession,
        Self::ObserveKnowledge,
        Self::ObserveEpiPersonal,
        Self::WriteEpiNara,
        Self::DispatchEpiNaraAction,
        Self::DispatchEpiPersonalAction,
        Self::ObserveCentralNow,
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
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "bridge caller {:?} is not authorised for {:?}", self.caller, self.call)
    }
}

impl std::error::Error for BridgeDenied {}

/// Root-shell bridge policy. Third-party/rich contributions are hosted only as
/// declarative read models. Presence in a Surface catalog never grants access to
/// the protected Personal body, Agent Context, Central NOW, or privileged native
/// dispatchers. The root shell may invoke those native seams explicitly; a
/// sandboxed contribution may not acquire that authority by being mounted.
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
