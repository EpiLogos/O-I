use crate::{BridgeCallClass, BridgeCaller, BridgeDenied, BridgePolicy};
use oi_cli::status::{NativeSurfaceState, SuiteCompositionDisclosure, SurfaceDisclosure};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ShellDestination {
    Home,
    Epi,
    Personal,
    Build,
    Explore,
    System,
}

impl ShellDestination {
    pub const ALL: [Self; 6] = [
        Self::Home,
        Self::Epi,
        Self::Personal,
        Self::Build,
        Self::Explore,
        Self::System,
    ];
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SuiteCondition {
    Empty,
    Partial,
    Broken,
    Full,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct SemanticRef {
    #[serde(rename = "ref")]
    pub ref_id: String,
    pub kind: String,
    pub native_owner: String,
    pub provenance: RefProvenance,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
pub struct RefProvenance {
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revision: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct ShellSnapshot {
    pub schema: &'static str,
    pub destination: ShellDestination,
    pub suite_condition: SuiteCondition,
    pub surfaces: Vec<SurfaceDisclosure>,
    pub destinations: Vec<ShellDestination>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selection: Option<SemanticRef>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct DesktopHost {
    disclosure: SuiteCompositionDisclosure,
    destination: ShellDestination,
    selection: Option<SemanticRef>,
    bridge: BridgePolicy,
}

impl DesktopHost {
    pub fn new(disclosure: SuiteCompositionDisclosure) -> Self {
        Self {
            disclosure,
            destination: ShellDestination::Home,
            selection: None,
            bridge: BridgePolicy,
        }
    }

    pub fn snapshot(&self, caller: BridgeCaller) -> Result<ShellSnapshot, BridgeDenied> {
        self.bridge.authorize(caller, BridgeCallClass::DiscloseComposition)?;
        Ok(ShellSnapshot {
            schema: "oi.desktop-shell/v1",
            destination: self.destination,
            suite_condition: suite_condition(&self.disclosure.surfaces),
            surfaces: self.disclosure.surfaces.clone(),
            destinations: ShellDestination::ALL.to_vec(),
            selection: self.selection.clone(),
            warnings: self.disclosure.warnings.clone(),
        })
    }

    pub fn select(&mut self, caller: BridgeCaller, subject: SemanticRef) -> Result<(), BridgeDenied> {
        self.bridge.authorize(caller, BridgeCallClass::SelectSemanticRef)?;
        self.selection = Some(subject);
        Ok(())
    }

    pub fn open_destination(&mut self, caller: BridgeCaller, destination: ShellDestination) -> Result<(), BridgeDenied> {
        self.bridge.authorize(caller, BridgeCallClass::OpenDestination)?;
        self.destination = destination;
        Ok(())
    }
}

fn suite_condition(surfaces: &[SurfaceDisclosure]) -> SuiteCondition {
    if surfaces.iter().any(|surface| surface.state == NativeSurfaceState::Broken) {
        return SuiteCondition::Broken;
    }
    if surfaces.is_empty() || surfaces.iter().all(|surface| surface.state == NativeSurfaceState::Missing) {
        return SuiteCondition::Empty;
    }
    if surfaces.iter().all(|surface| surface.state == NativeSurfaceState::Registered) {
        return SuiteCondition::Full;
    }
    SuiteCondition::Partial
}
