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
    SelectSemanticRef,
    OpenDestination,
}

impl BridgeCallClass {
    pub const ALL: [Self; 3] = [
        Self::DiscloseComposition,
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
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "bridge caller {:?} is not authorised for {:?}", self.caller, self.call)
    }
}

impl std::error::Error for BridgeDenied {}

/// D0 bridge policy. The only privileged caller is the root shell UI. Rich or
/// third-party contribution code receives no native bridge authority merely by
/// being rendered; D1 may add narrowly scoped native Action bindings later.
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
