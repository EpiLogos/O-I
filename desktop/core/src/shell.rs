use crate::events::KernelEvent;
use crate::focus::{FocusRefError, GlobalFocus, WorldRef};
use crate::{BridgeCallClass, BridgeCaller, BridgeDenied, BridgePolicy};
use oi_cli::current_world::{live_current_world, CurrentWorldReading};
use oi_cli::status::{NativeSurfaceState, SuiteCompositionDisclosure, SurfaceDisclosure};
use oi_cli::world_recognition::{discover_ground, WorldRecognitionAccount};
use serde::{Deserialize, Serialize};
use std::fmt;
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
    /// The one current subject, carried for existing readers as a projection
    /// of `focus` — never a second copy of the relation (02 §7).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selection: Option<SemanticRef>,
    /// The one global focus relation (02 §7), kernel-owned. Consumers
    /// bootstrap from this pull and then follow `FocusChanged` events.
    pub focus: GlobalFocus,
    #[serde(default)]
    pub warnings: Vec<String>,
}

/// Why a selection did not become the one current focus.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SelectionError {
    Denied(BridgeDenied),
    InvalidSubject(FocusRefError),
}

impl fmt::Display for SelectionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Denied(denied) => denied.fmt(formatter),
            Self::InvalidSubject(error) => error.fmt(formatter),
        }
    }
}

impl std::error::Error for SelectionError {}

impl From<BridgeDenied> for SelectionError {
    fn from(denied: BridgeDenied) -> Self {
        Self::Denied(denied)
    }
}

#[derive(Clone, Debug)]
pub struct DesktopHost {
    disclosure: SuiteCompositionDisclosure,
    current_world: CurrentWorldReading,
    world_recognition: Option<WorldRecognitionAccount>,
    destination: ShellDestination,
    focus: GlobalFocus,
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
        let focus = Self::initial_focus(&world_recognition);
        Self {
            disclosure,
            current_world,
            world_recognition,
            destination: ShellDestination::Home,
            focus,
            bridge: BridgePolicy,
        }
    }

    /// The focus relation a cold start opens with: the current World relation
    /// when recognition established that a World exists here (03 §A), and no
    /// subject — `B0 No focus` (03 §B). Absence is never fabricated.
    fn initial_focus(world_recognition: &Option<WorldRecognitionAccount>) -> GlobalFocus {
        let mut focus = GlobalFocus::unfocused();
        if world_recognition.is_some() {
            focus.bind_world(personal_world_ref());
        }
        focus
    }

    pub fn with_current_world(mut self, current_world: CurrentWorldReading) -> Self {
        self.current_world = current_world;
        self
    }

    pub fn current_world(&self) -> &CurrentWorldReading {
        &self.current_world
    }

    /// The one global focus relation (02 §7) as kernel state.
    pub fn focus(&self) -> &GlobalFocus {
        &self.focus
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
            selection: self.focus.subject_ref().cloned(),
            focus: self.focus.clone(),
            warnings: self.disclosure.warnings.clone(),
        })
    }

    /// Make `subject` the one current focus kernel-wide (02 §7, 03 §B) and
    /// emit the `FocusChanged` event every surface may consume.
    ///
    /// Returns `Ok(None)` when nothing changed: re-selecting the current
    /// subject mutates no kernel state and therefore emits no event. An
    /// unauthorised caller is denied exactly as before; events add no renderer
    /// authority (02 §12).
    pub fn select(
        &mut self,
        caller: BridgeCaller,
        subject: SemanticRef,
    ) -> Result<Option<KernelEvent>, SelectionError> {
        self.bridge
            .authorize(caller, BridgeCallClass::SelectSemanticRef)?;
        let previous = self.focus.clone();
        self.focus
            .focus_subject(subject)
            .map_err(SelectionError::InvalidSubject)?;
        if self.focus == previous {
            return Ok(None);
        }
        Ok(Some(KernelEvent::FocusChanged {
            focus: self.focus.clone(),
        }))
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
    ///
    /// The composed World changed → the kernel emits `WorldChanged`, so every
    /// surface re-renders reality instead of polling for it (02 §5). Returns
    /// `Ok(None)` when the re-observation is identical to what is held.
    pub fn reconcile_world(&mut self) -> Result<Option<KernelEvent>, String> {
        let ground = self
            .disclosure
            .personal_ground
            .as_deref()
            .ok_or_else(|| "no personal ground configured for World reconciliation".to_owned())?;
        match discover_ground(Path::new(ground)) {
            Ok(account) => {
                let unchanged = self.world_recognition.as_ref() == Some(&account);
                self.world_recognition = Some(account.clone());
                self.bind_current_world_relation();
                if unchanged {
                    return Ok(None);
                }
                let world = self
                    .focus
                    .world
                    .clone()
                    .ok_or_else(|| "current World relation unresolved".to_owned())?;
                Ok(Some(KernelEvent::WorldChanged {
                    world,
                    summary: format!(
                        "World recognition re-observed for {} ({} source apertures).",
                        account.target,
                        account.sources.len()
                    ),
                }))
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

    /// Name the current World relation from the configured personal ground.
    ///
    /// The host's own recognition is what establishes that a World exists here
    /// at all (03 §A); naming that ground `world:personal` follows the design's
    /// World-tree vocabulary (01 §2). When WorldService resolves Central's
    /// WorldRef/WorldGraph, it becomes the authoritative source of this
    /// relation and this derivation retires.
    fn bind_current_world_relation(&mut self) {
        if self.world_recognition.is_some() && self.focus.world.is_none() {
            self.focus.bind_world(personal_world_ref());
        }
    }
}

/// The current World relation, named from the host's configured personal
/// ground (01 §2: `world:personal` is the root of the World tree). Central
/// world recognition is what establishes that this World exists here. When
/// WorldService resolves Central's `WorldRef`/`WorldGraph`, it becomes the
/// authoritative source of this relation and this derivation retires.
fn personal_world_ref() -> WorldRef {
    WorldRef::try_from(SemanticRef {
        ref_id: "world:personal".to_owned(),
        kind: "world".to_owned(),
        native_owner: "central".to_owned(),
        provenance: crate::RefProvenance {
            source: "Central world recognition".to_owned(),
            revision: None,
        },
    })
    .expect("the built-in personal World ref is a whole ref")
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
