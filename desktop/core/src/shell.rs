use crate::contribution::HostedContribution;
use crate::events::KernelEvent;
use crate::focus::{FocusRefError, GlobalFocus};
use crate::world::{
    personal_world_ref, CentralWorldClient, CompositionReading, SourceWriteOutcome, SubjectOpen,
    WorldSourceError, WorldService, WorldTreeReading,
};
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

/// Why a subject could not be opened. An owner's refusal to serve the reading
/// is *not* this error: it is disclosed in the reading as the observation it
/// is (02 §10 — absence and refusal are disclosed, never failed).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum SubjectOpenError {
    Denied(BridgeDenied),
    InvalidSubject(FocusRefError),
}

impl fmt::Display for SubjectOpenError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Denied(denied) => denied.fmt(formatter),
            Self::InvalidSubject(error) => error.fmt(formatter),
        }
    }
}

impl std::error::Error for SubjectOpenError {}

impl From<BridgeDenied> for SubjectOpenError {
    fn from(denied: BridgeDenied) -> Self {
        Self::Denied(denied)
    }
}

impl From<SelectionError> for SubjectOpenError {
    fn from(error: SelectionError) -> Self {
        match error {
            SelectionError::Denied(denied) => Self::Denied(denied),
            SelectionError::InvalidSubject(error) => Self::InvalidSubject(error),
        }
    }
}

/// Why live World reconciliation could not complete — carrying the events the
/// attempt nonetheless produced. Withdrawing recognition unbinds the World
/// relation it had established, and that focus mutation emits
/// **unconditionally**: the renderer's event-derived focus mirror has to
/// follow the kernel even on an error path, or the two diverge with no event
/// left to reconcile them (K2 fix round 1, F-I1).
#[derive(Clone, Debug)]
pub struct ReconcileError {
    /// The events the reconciliation produced before failing — at least the
    /// `FocusChanged` that withdraws the World relation, when one stood.
    pub events: Vec<KernelEvent>,
    /// The observation failure itself, as it stands.
    pub reason: String,
}

impl fmt::Display for ReconcileError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.reason.fmt(formatter)
    }
}

impl std::error::Error for ReconcileError {}

#[derive(Clone, Debug)]
pub struct DesktopHost {
    disclosure: SuiteCompositionDisclosure,
    current_world: CurrentWorldReading,
    world_recognition: Option<WorldRecognitionAccount>,
    destination: ShellDestination,
    focus: GlobalFocus,
    bridge: BridgePolicy,
    /// The WorldService (02 §3): the first-class authored World read as a
    /// selected Projection. It adds no authority — every live fact it reads
    /// goes through the owner's own Action, and the bridge still gates who may
    /// ask.
    world: WorldService,
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
        // No Central root is passed: which root Central serves is Central's own
        // concern (the desktop composes and discloses, never relocates its
        // owner). The executable is discovered from the environment exactly as
        // the other owner-Action adapters discover theirs.
        let world = WorldService::discover(None);
        Self {
            disclosure,
            current_world,
            world_recognition,
            destination: ShellDestination::Home,
            focus,
            bridge: BridgePolicy,
            world,
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

    /// The World tree read as a Projection (01 §2): `world:personal` at the
    /// root, each `world:project:<id>` a descendant, every node carrying its
    /// authored-ground identity, owner-declared source treatment and Wiki ref.
    ///
    /// A read mutates no kernel state and emits no event; the tree is a
    /// reading, and degradation is local to the seam that could not serve it.
    pub fn world_tree(&mut self, caller: BridgeCaller) -> Result<WorldTreeReading, BridgeDenied> {
        self.bridge.authorize(caller, BridgeCallClass::ReadWorldTree)?;
        Ok(self.world.read_tree(
            self.world_recognition.as_ref(),
            self.disclosure.personal_ground.as_deref(),
            self.focus.project_ref().map(|project| project.ref_id.as_str()),
        ))
    }

    /// The live composition reading (02 §2 `composition`, 02 §11 Retire):
    /// what is present / degraded / absent, as observed from live recognition,
    /// capability descriptors and the host's own read model. A
    /// fixture-served constituent is an explicitly Degraded fallback and is
    /// never a presence source (02 §10).
    pub fn composition_reading(
        &self,
        caller: BridgeCaller,
        hosted: &[HostedContribution],
    ) -> Result<CompositionReading, BridgeDenied> {
        self.bridge
            .authorize(caller, BridgeCallClass::ReadComposition)?;
        Ok(CompositionReading::compose(
            self.world_recognition.as_ref(),
            &self.disclosure,
            hosted,
        ))
    }

    /// `open subject` (02 §5): make `subject` the one current focus
    /// kernel-wide and read it through its owner's authority gate. The focus
    /// mutation and the reading are one operation, so a human and an Agent
    /// opening the same ref reach the same actuality (04 §4).
    ///
    /// Opening a World-tree project node also binds the current Project
    /// relation — resolved through WorldService's own tree, never inferred
    /// from the ref's kind or string — which is how the project's sources are
    /// then addressed (02 §7 co-reference).
    ///
    /// Returns **every** focus event the operation's mutations produced, in
    /// emission order: the Project-relation bind and then the selection, each
    /// of which emits its own `FocusChanged` when it changes — so binding the
    /// relation emits even when the selection itself changes nothing (K2 fix
    /// round 1, F-I2; there is no focus mutation without its event). The
    /// subject's reading comes back beside them. An owner refusal is
    /// disclosed in the reading, not raised here.
    pub fn open_subject(
        &mut self,
        caller: BridgeCaller,
        subject: SemanticRef,
    ) -> Result<SubjectOpen, SubjectOpenError> {
        // Both classes are authorised before anything mutates, so an
        // authorisation refusal can never arrive after a mutation was made.
        self.bridge
            .authorize(caller, BridgeCallClass::OpenSubject)?;
        self.bridge
            .authorize(caller, BridgeCallClass::SelectSemanticRef)?;
        // Resolution goes through the Projection; an open that needs a tree
        // and holds none composes it once, rather than guessing from the ref.
        if self.world.tree().is_none() {
            self.world_tree(caller)?;
        }
        let project_to_bind = match self.world.project_ref_of(&subject) {
            Some(project)
                if !self
                    .focus
                    .project_ref()
                    .is_some_and(|bound| bound.ref_id == project.ref_id) =>
            {
                Some(
                    crate::focus::ProjectRef::try_from(project)
                        .map_err(SubjectOpenError::InvalidSubject)?,
                )
            }
            _ => None,
        };
        // The whole mutation is validated on a scratch relation first, so an
        // invalid subject mutates no kernel state and no event can lie about
        // a change that never happened.
        let mut next = self.focus.clone();
        if let Some(project) = &project_to_bind {
            next.bind_project(project.clone());
        }
        next.focus_subject(subject.clone())
            .map_err(SubjectOpenError::InvalidSubject)?;

        // Commit. Each mutation emits the event that discloses it.
        let mut events = Vec::new();
        if let Some(project) = project_to_bind {
            self.focus.bind_project(project);
            events.push(KernelEvent::FocusChanged {
                focus: self.focus.clone(),
            });
        }
        // Already authorised and validated above; this cannot fail.
        events.extend(self.select(caller, subject.clone())?);
        let focused_project = self
            .focus
            .project_ref()
            .map(|project| project.ref_id.as_str());
        let mut reading = self.world.open_subject(subject, focused_project);
        // Selection is kernel state, and the reading is its projection (02
        // §7): the reading carries `selected` from the one focus relation
        // after the mutation, never from the read itself.
        if self
            .focus
            .subject_ref()
            .is_some_and(|selected| selected.ref_id == reading.subject.ref_id)
        {
            reading.access = reading.access.selected();
        }
        Ok(SubjectOpen { events, reading })
    }

    /// Save one World source through Central's own authority gate (02 §9.4):
    /// Central's compare-and-swap, Central's attribution, Central's refusal
    /// semantics. The desktop adds no bypass, never parses conflict text, and
    /// returns the `SourceChanged` event the write produced — none when
    /// Central recorded no change.
    pub fn save_subject(
        &mut self,
        caller: BridgeCaller,
        source_ref: &str,
        expected_revision: &str,
        content: &str,
        actor: &str,
    ) -> Result<SourceWriteOutcome, WorldSourceError> {
        self.bridge
            .authorize(caller, BridgeCallClass::MutateWorldSource)?;
        let focused_project = self.focus.project_ref().map(|project| project.ref_id.as_str());
        self.world
            .save_subject(source_ref, expected_revision, content, actor, focused_project)
    }

    /// The Central owner-Action client WorldService reads through, for hosts
    /// that must reuse the same seam (a test or a fixture harness never
    /// mints its own adapter).
    pub fn central_world_client(&self) -> Option<&CentralWorldClient> {
        self.world.client()
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
    /// Returns **every** event the reconciliation produced, in emission order:
    /// `WorldChanged` when the composed World changed, plus `FocusChanged` when
    /// the reconciliation also named the current World relation (every kernel
    /// mutation emits the event it produced — there is no path that changes
    /// focus without an event). An unchanged re-observation emits nothing.
    ///
    /// When the observation itself fails, the error is a [`ReconcileError`]
    /// that **carries the events the attempt produced**: withdrawing a failed
    /// observation unbinds the World relation, and that `FocusChanged` reaches
    /// the renderer even though the call fails (K2 fix round 1, F-I1) — a
    /// kernel state change is never dropped for lack of a success value.
    pub fn reconcile_world(&mut self) -> Result<Vec<KernelEvent>, ReconcileError> {
        let ground = self.disclosure.personal_ground.as_deref().ok_or_else(|| ReconcileError {
            events: Vec::new(),
            reason: "no personal ground configured for World reconciliation".to_owned(),
        })?;
        match discover_ground(Path::new(ground)) {
            Ok(account) => self.reconcile_world_from(Some(account)).map_err(|reason| {
                ReconcileError {
                    events: Vec::new(),
                    reason,
                }
            }),
            Err(error) => {
                // Recognition withdrawn is an observation, and unbinding the
                // World relation it had established is disclosed as the event
                // it produces — unconditionally, even though this observation
                // failed. The events travel with the error so the host still
                // forwards them.
                let events = self.reconcile_world_from(None).unwrap_or_default();
                self.current_world
                    .warnings
                    .push(format!("World recognition unavailable: {error}"));
                Err(ReconcileError {
                    events,
                    reason: error,
                })
            }
        }
    }

    /// Reconcile from an already-observed recognition account — the pure core
    /// of [`DesktopHost::reconcile_world`], so the invariant "every focus
    /// mutation emits its event" is pinned directly on the reconciliation
    /// path, not only on the live discovery path that happens to reach it.
    ///
    /// Passing `None` withdraws recognition: the World relation it had
    /// established is unbound and that withdrawal is emitted, exactly as
    /// binding it was.
    pub fn reconcile_world_from(
        &mut self,
        account: Option<WorldRecognitionAccount>,
    ) -> Result<Vec<KernelEvent>, String> {
        let unchanged = self.world_recognition == account;
        self.world_recognition = account;
        let mut events = Vec::new();
        if let Some(event) = self.bind_current_world_relation() {
            events.push(event);
        }
        if unchanged {
            return Ok(events);
        }
        let Some(account) = self.world_recognition.as_ref() else {
            // Recognition withdrawn: the unbinding above is the disclosure of
            // that withdrawal. There is no World left to name, so no
            // `WorldChanged` — and nothing is fabricated in its place.
            return Ok(events);
        };
        let world = self
            .focus
            .world
            .clone()
            .ok_or_else(|| "current World relation unresolved".to_owned())?;
        events.push(KernelEvent::WorldChanged {
            world,
            summary: format!(
                "World recognition re-observed for {} ({} source apertures).",
                account.target,
                account.sources.len()
            ),
        });
        Ok(events)
    }

    /// Name the current World relation from the configured personal ground,
    /// returning the `FocusChanged` event the binding produced — `None` when
    /// the relation already stood, because a kernel operation that changes
    /// nothing emits nothing.
    ///
    /// The host's own recognition is what establishes that a World exists here
    /// at all (03 §A); WorldService names the relation (`world:personal`, the
    /// root of the World tree, 01 §2), and this is the one place that binds or
    /// releases it.
    fn bind_current_world_relation(&mut self) -> Option<KernelEvent> {
        match (self.world_recognition.is_some(), self.focus.world.is_some()) {
            (true, false) => {
                self.focus.bind_world(personal_world_ref());
                Some(KernelEvent::FocusChanged {
                    focus: self.focus.clone(),
                })
            }
            (false, true) => {
                self.focus.world = None;
                Some(KernelEvent::FocusChanged {
                    focus: self.focus.clone(),
                })
            }
            _ => None,
        }
    }
}

pub(crate) fn suite_condition(surfaces: &[SurfaceDisclosure]) -> SuiteCondition {
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

#[cfg(test)]
mod tests {
    use super::*;
    use oi_cli::world_recognition::RecognizedSourceAperture;

    fn disclosure() -> SuiteCompositionDisclosure {
        SuiteCompositionDisclosure {
            schema: "oi.desktop-composition-disclosure/v1".to_owned(),
            personal_ground: Some("/central".to_owned()),
            surfaces: Vec::new(),
            warnings: Vec::new(),
        }
    }

    fn account() -> WorldRecognitionAccount {
        WorldRecognitionAccount {
            schema: "oi.world-recognition-account/v1".to_owned(),
            target: "/central".to_owned(),
            sources: vec![RecognizedSourceAperture {
                path: "ProjectCentral/user".to_owned(),
                class: "authored-project-ground".to_owned(),
                owner: "Central".to_owned(),
                standing: "authoritative-when-projectcentral-conformant".to_owned(),
                treatment: "retain-in-place".to_owned(),
                evidence: "directory-present".to_owned(),
            }],
            providers: Vec::new(),
            observations: Vec::new(),
            owner_participations: Vec::new(),
            owner_contracts: Vec::new(),
            owner_capacities: Vec::new(),
            extension_requests: Vec::new(),
            provider_errors: Vec::new(),
        }
    }

    /// Pinned (K1 deferred minor M2): reconciliation may name or release the
    /// current World relation, and whichever it does is emitted. There is no
    /// path that mutates focus without the event that discloses it.
    #[test]
    fn reconciliation_emits_every_focus_mutation_it_makes() {
        let mut host = DesktopHost::new(disclosure());
        // Recognition was observed at startup with no world relation? No: the
        // host binds it at startup. Withdraw recognition first so the binding
        // path is reachable here.
        host.world_recognition = None;
        host.focus = GlobalFocus::unfocused();

        // Binding the relation on reconciliation emits FocusChanged.
        let events = host
            .reconcile_world_from(Some(account()))
            .expect("reconciliation from an observed account");
        assert_eq!(events.len(), 2, "the focus mutation and the World change");
        assert_eq!(events[0].tag(), "focus_changed");
        assert_eq!(events[1].tag(), "world_changed");
        assert!(host.focus.world.is_some());

        // Reconciling the same account again mutates nothing and emits
        // nothing.
        let events = host.reconcile_world_from(Some(account())).unwrap();
        assert!(events.is_empty(), "an unchanged re-observation emits nothing");

        // Withdrawing recognition releases the relation and emits that too.
        let events = host.reconcile_world_from(None).unwrap();
        assert_eq!(events.len(), 1, "the withdrawal is disclosed as its event");
        assert_eq!(events[0].tag(), "focus_changed");
        assert!(host.focus.world.is_none(), "absence is held, not papered over");
    }
}
