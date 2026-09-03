use crate::{BridgeCallClass, BridgeCaller, BridgeDenied, BridgePolicy};
use oi_cli::current_world::{live_current_world, CurrentWorldReading};
use oi_cli::status::{NativeSurfaceState, SuiteCompositionDisclosure, SurfaceDisclosure};
use oi_cli::world_recognition::{discover_ground, WorldRecognitionAccount};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ShellDestination {
    Home,
    Personal,
    Build,
    Explore,
    System,
}

impl ShellDestination {
    pub const ALL: [Self; 5] = [
        Self::Home,
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

#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct ShellSnapshot {
    pub schema: &'static str,
    pub destination: ShellDestination,
    pub suite_condition: SuiteCondition,
    pub current_world: CurrentWorldReading,
    pub surfaces: Vec<SurfaceDisclosure>,
    pub destinations: Vec<ShellDestination>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub world_recognition: Option<WorldRecognitionAccount>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selection: Option<SemanticRef>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct DesktopHost {
    disclosure: SuiteCompositionDisclosure,
    current_world: CurrentWorldReading,
    world_recognition: Option<WorldRecognitionAccount>,
    destination: ShellDestination,
    selection: Option<SemanticRef>,
    bridge: BridgePolicy,
}

impl DesktopHost {
    pub fn new(disclosure: SuiteCompositionDisclosure) -> Self {
        let mut current_world = live_current_world().unwrap_or_else(|error| {
            let mut reading = CurrentWorldReading::from_disclosure(&disclosure);
            reading.warnings.push(format!(
                "live CurrentWorld enrichment unavailable; using suite disclosure: {error}"
            ));
            reading
        });
        let world_recognition = disclosure
            .personal_ground
            .as_deref()
            .and_then(|ground| match discover_ground(Path::new(ground)) {
                Ok(account) => Some(account),
                Err(error) => {
                    current_world
                        .warnings
                        .push(format!("World recognition unavailable: {error}"));
                    None
                }
            });
        Self {
            disclosure,
            current_world,
            world_recognition,
            destination: ShellDestination::Home,
            selection: None,
            bridge: BridgePolicy,
        }
    }

    pub fn with_current_world(mut self, current_world: CurrentWorldReading) -> Self {
        self.current_world = current_world;
        self
    }

    pub fn current_world(&self) -> &CurrentWorldReading {
        &self.current_world
    }

    pub fn snapshot(&self, caller: BridgeCaller) -> Result<ShellSnapshot, BridgeDenied> {
        self.bridge
            .authorize(caller, BridgeCallClass::DiscloseComposition)?;
        Ok(ShellSnapshot {
            schema: "oi.desktop-shell/v1",
            destination: self.destination,
            suite_condition: suite_condition(&self.disclosure.surfaces),
            current_world: self.current_world.clone(),
            surfaces: self.disclosure.surfaces.clone(),
            destinations: ShellDestination::ALL.to_vec(),
            world_recognition: self.world_recognition.clone(),
            selection: self.selection.clone(),
            warnings: self.disclosure.warnings.clone(),
        })
    }

    pub fn select(
        &mut self,
        caller: BridgeCaller,
        subject: SemanticRef,
    ) -> Result<(), BridgeDenied> {
        self.bridge
            .authorize(caller, BridgeCallClass::SelectSemanticRef)?;
        self.selection = Some(subject);
        Ok(())
    }

    pub fn open_destination(
        &mut self,
        caller: BridgeCaller,
        destination: ShellDestination,
    ) -> Result<(), BridgeDenied> {
        self.bridge
            .authorize(caller, BridgeCallClass::OpenDestination)?;
        self.destination = destination;
        Ok(())
    }

    /// Re-observe the live World without a restart. This is the same
    /// deterministic discover/observe/reconcile operation the host already
    /// performs at startup; it refreshes the read model, never grants new
    /// authority and never invokes a model or Agent.
    pub fn reconcile_world(&mut self) -> Result<WorldRecognitionAccount, String> {
        let ground = self
            .disclosure
            .personal_ground
            .as_deref()
            .ok_or_else(|| "no personal ground configured for World reconciliation".to_owned())?;
        match discover_ground(Path::new(ground)) {
            Ok(account) => {
                self.world_recognition = Some(account.clone());
                Ok(account)
            }
            Err(error) => {
                self.world_recognition = None;
                self.current_world
                    .warnings
                    .push(format!("World recognition unavailable: {error}"));
                Err(error)
            }
        }
    }
}

fn suite_condition(surfaces: &[SurfaceDisclosure]) -> SuiteCondition {
    if surfaces
        .iter()
        .any(|surface| surface.state == NativeSurfaceState::Broken)
    {
        return SuiteCondition::Broken;
    }
    if surfaces.is_empty()
        || surfaces
            .iter()
            .all(|surface| surface.state == NativeSurfaceState::Missing)
    {
        return SuiteCondition::Empty;
    }
    if surfaces
        .iter()
        .all(|surface| surface.state == NativeSurfaceState::Registered)
    {
        return SuiteCondition::Full;
    }
    SuiteCondition::Partial
}
