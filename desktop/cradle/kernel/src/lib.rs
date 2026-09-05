//! The cradle kernel — the composition surface's own mechanics (map §2:
//! "its kernel (stable refs, one global focus, ordered events)"), ported
//! KEEP-RE-EARN from `desktop/core` into the fresh shell and re-proven by
//! the U0.4 walk.
//!
//! What the kernel owns here:
//!
//! - **One global focus** (`focus.rs`, ported as-is) — the single notion of
//!   what the whole application is talking about.
//! - **The ordered event seam** (`events.rs`, ported law) — every kernel
//!   state change emits exactly one typed event into a log whose seqs are
//!   monotonic from 1 with no gaps; operations return the receipts they
//!   produced and none when nothing changed.
//! - **Two state layers** (map §1 law / 05 §4): the dirty buffer is
//!   cradle-held presentation state; the canonical revision is
//!   Central-owned. Saving is a compare-and-swap through
//!   `projectcentral.source.write` carrying the buffer's base revision; a
//!   save never overwrites either side silently.
//! - **Structured conflict** (`flow.rs::SourceWriteFailure`): a failed CAS
//!   surfaces `{kind: "revision-conflict", expected, current}` with BOTH
//!   sides preserved — the buffer content kept dirty, the canonical
//!   content re-readable. Never data loss.
//! - **Reading core only** (`world.rs`): participating sources from the
//!   owner's horizon/ground disclosures; no tree, no UI coupling.
//!
//! The kernel never writes files and never mints refs: every source ref is
//! Central's canonical grammar, carried verbatim.

pub mod events;
pub mod flow;
pub mod focus;
pub mod refs;
pub mod world;

pub use flow::CentralClient;

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use events::{KernelEvent, KernelEventLog, KernelEventReceipt};
use flow::{CRADLE_ACTOR, CRADLE_ACTOR_KIND, OwnerCallError, SourceReading, SourceWriteFailure};
use focus::GlobalFocus;
use refs::{source_semantic_ref, SemanticRef};
use world::{participating_sources, SourceListing};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/// One surface binding the kernel knows: S's own presentation mechanic
/// (law 12), carrying the owner ref verbatim when the binding has one.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SurfaceState {
    pub surface_id: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_ref: Option<String>,
    pub title: String,
}

/// The conflict record a failed CAS leaves in the buffer: both observed
/// revisions plus the canonical content as the owner holds it now — the
/// other side of the two preserved layers, re-readable without losing the
/// buffer.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceConflict {
    pub expected_revision: String,
    pub current_revision: String,
    /// The canonical content the re-read observed (the external side).
    pub canonical_content: String,
}

/// The two state layers for one open source:
///
/// - `content` — the cradle-held dirty buffer (presentation state);
/// - `saved_content` + `base_revision` — the canonical layer the buffer is
///   based on (Central-owned revision).
///
/// `dirty` says whether the two layers differ. A save CAS-writes `content`
/// against `base_revision`; a conflict keeps both layers intact.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SourceBuffer {
    pub source_ref: String,
    /// The cradle-held buffer (presentation layer).
    pub content: String,
    /// The canonical content at `base_revision`.
    pub saved_content: String,
    /// The canonical revision this buffer is based on.
    pub base_revision: String,
    pub dirty: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conflict: Option<SourceConflict>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

/// The whole kernel state, pulled by read models (events only trigger
/// re-renders — the pull is the truth). Empty maps serialise as `{}` (not
/// omitted): the wire shape is stable for the typed consumer.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct KernelSnapshot {
    pub focus: GlobalFocus,
    #[serde(default)]
    pub surfaces: BTreeMap<String, SurfaceState>,
    #[serde(default)]
    pub buffers: BTreeMap<String, SourceBuffer>,
    pub navigator: world::NavigatorReading,
}

/// The kernel itself. All mutation goes through [`Kernel::apply`]; every
/// state change is recorded exactly once on the ordered log.
#[derive(Debug)]
pub struct Kernel {
    client: CentralClient,
    focus: GlobalFocus,
    log: KernelEventLog,
    surfaces: BTreeMap<String, SurfaceState>,
    buffers: BTreeMap<String, SourceBuffer>,
    navigator: world::NavigatorReading,
}

// ---------------------------------------------------------------------------
// Operations — the typed seam the host (Tauri commands or the dev-only
// walk bridge) forwards. One operation = a real act; each returns the
// receipts its state changes produced.
// ---------------------------------------------------------------------------

/// One kernel operation. `project` stays optional everywhere: the
/// configured project query is the co-reference fallback (02 §7).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum KernelOp {
    /// Pull the whole kernel state (read model; emits nothing).
    State,
    WorldRead,
    ProjectRead { project: String },
    /// List a project's participating sources from the owner's
    /// disclosures (read-only; emits nothing).
    SourcesList { #[serde(default)] project: Option<String> },
    /// Open a source into the buffer layer through the owner's read.
    SourceOpen {
        #[serde(default)] project: Option<String>,
        source_ref: String,
    },
    /// Set the cradle-held buffer content. Emits `buffer_dirty` exactly
    /// once per clean/dirty crossing — continued typing emits nothing.
    SourceEdit { source_ref: String, content: String },
    /// CAS-save the buffer through `projectcentral.source.write`.
    SourceSave {
        #[serde(default)] project: Option<String>,
        source_ref: String,
    },
    /// Re-read the canonical layer (the conflict reconcile path): rebases
    /// the buffer's base revision, keeps the dirty buffer content.
    SourceReread {
        #[serde(default)] project: Option<String>,
        source_ref: String,
    },
    /// Register a surface binding (frame state, law 12).
    SurfaceOpen {
        surface_id: String,
        kind: String,
        #[serde(default)] source_ref: Option<String>,
        title: String,
    },
    /// Close a surface binding. Closing the focused surface also clears
    /// the focus relation — two state changes, two receipts.
    SurfaceClose { surface_id: String },
    /// Make a surface's ref the one current focus subject. Emits
    /// `focus_changed` only when the relation actually moved.
    SurfaceFocus { surface_id: String },
}

/// What an operation produced: its payload plus the receipts of the state
/// changes it made (empty when it changed nothing).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct KernelOpOutcome {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub receipts: Vec<KernelEventReceipt>,
    #[serde(flatten)]
    pub result: KernelOpResult,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "result", rename_all = "snake_case")]
pub enum KernelOpResult {
    State { snapshot: KernelSnapshot },
    WorldRead { snapshot: KernelSnapshot },
    SourcesListed { listing: SourceListing },
    SourceOpened { buffer: SourceBuffer },
    BufferEdited { buffer: SourceBuffer },
    /// A save that recorded a change (or landed unchanged on an equal
    /// canonical): the receipt revision is the canonical layer now.
    SourceSaved {
        buffer: SourceBuffer,
        previous_revision: String,
        revision: String,
        changed: bool,
    },
    /// A save the owner's CAS refused. The failure is structured; the
    /// buffer state beside it carries both preserved sides.
    SourceSaveFailed {
        buffer: SourceBuffer,
        failure: SourceWriteFailure,
    },
    SourceReread { buffer: SourceBuffer },
    SurfaceOpened { snapshot: KernelSnapshot },
    SurfaceClosed { snapshot: KernelSnapshot },
    SurfaceFocused { snapshot: KernelSnapshot },
}

impl Kernel {
    pub fn new(client: CentralClient) -> Self {
        Self {
            client,
            focus: GlobalFocus::unfocused(),
            log: KernelEventLog::new(),
            surfaces: BTreeMap::new(),
            buffers: BTreeMap::new(),
            navigator: world::NavigatorReading::default(),
        }
    }

    pub fn discover() -> Self {
        Self::new(CentralClient::discover())
    }

    /// The ordered event log — the observable seam the host exposes by
    /// command and forwards by event.
    pub fn event_log(&self) -> &KernelEventLog {
        &self.log
    }

    pub fn snapshot(&self) -> KernelSnapshot {
        KernelSnapshot {
            focus: self.focus.clone(),
            surfaces: self.surfaces.clone(),
            buffers: self.buffers.clone(),
            navigator: self.navigator.clone(),
        }
    }

    /// Apply one operation. This is the only mutation path; it records
    /// exactly one receipt per kernel state change.
    pub fn apply(&mut self, op: KernelOp) -> Result<KernelOpOutcome, String> {
        match op {
            KernelOp::WorldRead => self.navigate(None),
            KernelOp::ProjectRead { project } => self.navigate(Some(&project)),
            KernelOp::State => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::State {
                    snapshot: self.snapshot(),
                },
            }),
            KernelOp::SourcesList { project } => Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::SourcesListed {
                    listing: participating_sources(&self.client, project.as_deref()),
                },
            }),
            KernelOp::SourceOpen { project, source_ref } => {
                self.source_open(project.as_deref(), &source_ref)
            }
            KernelOp::SourceEdit { source_ref, content } => {
                self.source_edit(&source_ref, content)
            }
            KernelOp::SourceSave { project, source_ref } => {
                self.source_save(project.as_deref(), &source_ref)
            }
            KernelOp::SourceReread { project, source_ref } => {
                self.source_reread(project.as_deref(), &source_ref)
            }
            KernelOp::SurfaceOpen {
                surface_id,
                kind,
                source_ref,
                title,
            } => self.surface_open(surface_id, kind, source_ref, title),
            KernelOp::SurfaceClose { surface_id } => self.surface_close(surface_id),
            KernelOp::SurfaceFocus { surface_id } => self.surface_focus(surface_id),
        }
    }

    // -----------------------------------------------------------------------
    // Source buffers — the two state layers
    // -----------------------------------------------------------------------

    fn navigate(&mut self, project: Option<&str>) -> Result<KernelOpOutcome, String> {
        let before = self.navigator.clone();
        let old_focus = self.focus.clone();
        let result = if let Some(query) = project {
            // Resolve only a project the owner's current root map disclosed.
            let known = self.navigator.root.as_ref().and_then(|r| r["work"]["projects"].as_array())
                .is_some_and(|rows| rows.iter().any(|p| p["name"].as_str() == Some(query)));
            if !known { return Err("Project is outside the disclosed World mapping; refresh World first".into()); }
            world::read_project(&self.client, query).map(|reading| {
                let bound = reading["project"]["projectcentral"]["state"] != "absent";
                let sources = bound.then(|| participating_sources(&self.client, Some(query)));
                let project_ref = if bound {
                    self.client.run("projectcentral.inspect", serde_json::json!({"project": query})).ok()
                        .and_then(|v| v["manifest"]["project_id"].as_str().filter(|id| !id.trim().is_empty()).map(str::to_owned))
                } else { None };
                self.focus.project = None;
                self.focus.world = None;
                self.focus.clear_subject();
                let semantic = |id: String, kind: &str| SemanticRef {
                    ref_id: id, kind: kind.into(), native_owner: "central".into(),
                    provenance: refs::RefProvenance { source: "projectcentral.inspect".into(), revision: None },
                };
                if let Some(id) = project_ref.as_ref() {
                    let reference = semantic(id.clone(), "project");
                    self.focus.bind_project(focus::ProjectRef::try_from(reference.clone()).expect("owner project ref"));
                    self.focus.focus_subject(reference).expect("owner project ref");
                }
                if let Some(id) = sources.as_ref().and_then(|s| s.world_ref.as_ref()).filter(|id| !id.trim().is_empty()) {
                    let mut reference = semantic(id.clone(), "world");
                    reference.provenance.source = "projectcentral.change.horizon".into();
                    self.focus.bind_world(focus::WorldRef::try_from(reference).expect("owner world ref"));
                }
                self.navigator.project = Some(reading);
                self.navigator.sources = sources;
                self.navigator.project_ref = project_ref;
            })
        } else {
            world::read_world(&self.client).map(|reading| {
                if self.navigator.project.is_some() {
                    self.focus.project = None;
                    self.focus.world = None;
                    self.focus.clear_subject();
                }
                self.navigator.root = Some(reading);
                self.navigator.project = None;
                self.navigator.sources = None;
                self.navigator.project_ref = None;
            })
        };
        self.navigator.error = result.err();
        let mut receipts = Vec::new();
        if self.navigator != before {
            receipts.push(self.log.record(KernelEvent::WorldChanged { summary: "Central navigator reading changed".into() }));
        }
        if self.focus != old_focus {
            receipts.push(self.log.record(KernelEvent::FocusChanged { focus: self.focus.clone() }));
        }
        Ok(KernelOpOutcome { receipts, result: KernelOpResult::WorldRead { snapshot: self.snapshot() } })
    }

    fn source_open(
        &mut self,
        project: Option<&str>,
        source_ref: &str,
    ) -> Result<KernelOpOutcome, String> {
        // The cradle holds unsaved work: opening the same ref again reveals
        // the existing buffer — it never clobbers a dirty layer.
        let held = self.buffers.get(source_ref).cloned();
        if let Some(buffer) = &held {
            if buffer.dirty {
                return Ok(KernelOpOutcome {
                    receipts: Vec::new(),
                    result: KernelOpResult::SourceOpened {
                        buffer: buffer.clone(),
                    },
                });
            }
        }
        let reading = self.owner_read(project, source_ref)?;
        // The kernel state changed only if a buffer was created or the
        // canonical layer moved under a clean buffer; a re-open of the same
        // clean revision emits nothing (02 §5: return none when nothing
        // changed).
        let changed = held
            .as_ref()
            .map(|buffer| buffer.base_revision != reading.revision.revision)
            .unwrap_or(true);
        let buffer = self.sync_buffer_from_reading(&reading, true);
        let receipt = changed.then(|| {
            self.log.record(KernelEvent::SourceOpened {
                source: source_semantic_ref(source_ref, Some(&reading.revision.revision))
                    .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                revision: reading.revision.revision.clone(),
                summary: format!(
                    "Opened from the owner's reading at revision {} ({} bytes).",
                    short_revision(&reading.revision.revision),
                    reading.revision.byte_len
                ),
            })
        });
        Ok(KernelOpOutcome {
            receipts: receipt.into_iter().collect(),
            result: KernelOpResult::SourceOpened { buffer },
        })
    }

    /// Re-read the canonical layer and sync the buffer to it. A clean
    /// buffer mirrors the canonical content; a dirty buffer keeps its
    /// content and only rebases (both layers stay distinct).
    fn sync_buffer_from_reading(&mut self, reading: &SourceReading, reset_content: bool) -> SourceBuffer {
        let source_ref = reading.source.source_ref.clone();
        let previous = self.buffers.get(&source_ref);
        let keep_dirty = previous.map(|buffer| buffer.dirty).unwrap_or(false);
        let content = if keep_dirty && !reset_content {
            previous.expect("dirty implies present").content.clone()
        } else {
            reading.content.clone()
        };
        let dirty = keep_dirty && content != reading.content;
        let buffer = SourceBuffer {
            source_ref: source_ref.clone(),
            content,
            saved_content: reading.content.clone(),
            base_revision: reading.revision.revision.clone(),
            dirty,
            conflict: None,
            path: Some(reading.source.path.clone()),
        };
        self.buffers.insert(source_ref, buffer.clone());
        buffer
    }

    fn source_edit(&mut self, source_ref: &str, content: String) -> Result<KernelOpOutcome, String> {
        let Some(buffer) = self.buffers.get_mut(source_ref) else {
            return Err(format!(
                "no open buffer for `{source_ref}`; a buffer exists only after the source is opened"
            ));
        };
        buffer.content = content;
        let now_dirty = buffer.content != buffer.saved_content;
        let crossed = now_dirty != buffer.dirty;
        buffer.dirty = now_dirty;
        let buffer = buffer.clone();
        let receipt = crossed.then(|| {
            self.log.record(KernelEvent::BufferDirty {
                source: source_semantic_ref(source_ref, Some(&buffer.base_revision))
                    .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                dirty: now_dirty,
                summary: if now_dirty {
                    "The cradle buffer crossed the clean/dirty line: it now differs from the canonical layer.".to_owned()
                } else {
                    "The cradle buffer returned to the canonical content: clean again.".to_owned()
                },
            })
        });
        Ok(KernelOpOutcome {
            receipts: receipt.into_iter().collect(),
            result: KernelOpResult::BufferEdited { buffer },
        })
    }

    fn source_save(
        &mut self,
        project: Option<&str>,
        source_ref: &str,
    ) -> Result<KernelOpOutcome, String> {
        let Some(buffer) = self.buffers.get(source_ref) else {
            return Err(format!("no open buffer for `{source_ref}`; nothing to save"));
        };
        let expected = buffer.base_revision.clone();
        let content = buffer.content.clone();
        match self.client.source_write(
            project,
            source_ref,
            &expected,
            &content,
            CRADLE_ACTOR,
            CRADLE_ACTOR_KIND,
        ) {
            Ok(receipt) => {
                let previous_revision = receipt.previous_revision.clone();
                let revision = receipt.revision.revision.clone();
                let changed = receipt.changed;
                // Sync both layers to the canonical state the owner recorded.
                // One state change — the save — one event: SourceChanged
                // (only when Central recorded a change; an unchanged write
                // mutated nothing and emits nothing).
                let event = changed.then(|| {
                    self.log.record(KernelEvent::SourceChanged {
                        source: source_semantic_ref(source_ref, Some(&revision))
                            .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                        revision: revision.clone(),
                        summary: format!(
                            "Saved through the owner's CAS: revision advanced {} -> {}.",
                            short_revision(&previous_revision),
                            short_revision(&revision)
                        ),
                    })
                });
                if let Some(buffer) = self.buffers.get_mut(source_ref) {
                    buffer.saved_content = content;
                    buffer.base_revision = revision.clone();
                    buffer.dirty = false;
                    buffer.conflict = None;
                }
                let buffer = self.buffers.get(source_ref).cloned().expect("just saved");
                Ok(KernelOpOutcome {
                    receipts: event.into_iter().collect(),
                    result: KernelOpResult::SourceSaved {
                        buffer,
                        previous_revision,
                        revision,
                        changed,
                    },
                })
            }
            Err(error) => {
                // The ported heuristic: on a write error, re-read and
                // compare revisions — never parse conflict prose. Both
                // sides are preserved on a conflict: the buffer content
                // stays as it is (dirty), the canonical content is kept
                // re-readable in the conflict record.
                let failure = match &error {
                    OwnerCallError::Unavailable { detail } => SourceWriteFailure::Unavailable {
                        source_ref: source_ref.to_owned(),
                        detail: detail.clone(),
                    },
                    OwnerCallError::Refused { .. } | OwnerCallError::Malformed { .. } => {
                        match self.client.current_reading(project, source_ref) {
                            Ok(current) => {
                                if current.revision.revision == expected {
                                    SourceWriteFailure::OwnerRefused {
                                        source_ref: source_ref.to_owned(),
                                        message: error.to_string(),
                                    }
                                } else {
                                    let failure = SourceWriteFailure::RevisionConflict {
                                        source_ref: source_ref.to_owned(),
                                        expected: expected.clone(),
                                        current: current.revision.revision.clone(),
                                    };
                                    let canonical_content = current.content.clone();
                                    let current_revision =
                                        current.revision.revision.clone();
                                    if let Some(buffer) = self.buffers.get_mut(source_ref) {
                                        buffer.conflict = Some(SourceConflict {
                                            expected_revision: expected.clone(),
                                            current_revision,
                                            canonical_content,
                                        });
                                    }
                                    failure
                                }
                            }
                            // The owner is not even re-readable: surface the
                            // original refusal honestly; no state changed.
                            Err(_) => SourceWriteFailure::OwnerRefused {
                                source_ref: source_ref.to_owned(),
                                message: error.to_string(),
                            },
                        }
                    }
                };
                let conflict_event = matches!(failure, SourceWriteFailure::RevisionConflict { .. })
                    .then(|| {
                        let (expected, current) = match &failure {
                            SourceWriteFailure::RevisionConflict { expected, current, .. } => {
                                (expected.clone(), current.clone())
                            }
                            _ => unreachable!("guarded by matches!"),
                        };
                        self.log.record(KernelEvent::SourceWriteConflict {
                            source: source_semantic_ref(source_ref, Some(&expected))
                                .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                            expected_revision: expected,
                            current_revision: current,
                            summary:
                                "The owner's CAS refused the save: the revision moved underneath the buffer. Both sides are preserved."
                                    .to_owned(),
                        })
                    });
                let buffer = self.buffers.get(source_ref).cloned().expect("save path holds it");
                Ok(KernelOpOutcome {
                    receipts: conflict_event.into_iter().collect(),
                    result: KernelOpResult::SourceSaveFailed { buffer, failure },
                })
            }
        }
    }

    fn source_reread(
        &mut self,
        project: Option<&str>,
        source_ref: &str,
    ) -> Result<KernelOpOutcome, String> {
        let had_conflict = self
            .buffers
            .get(source_ref)
            .map(|buffer| buffer.conflict.is_some())
            .unwrap_or(false);
        let old_base = self
            .buffers
            .get(source_ref)
            .map(|buffer| buffer.base_revision.clone());
        let reading = self.owner_read(project, source_ref)?;
        let moved = old_base
            .as_deref()
            .map(|base| base != reading.revision.revision)
            .unwrap_or(true);
        // Nothing changed — same revision, no conflict to clear — nothing
        // is emitted.
        let changed = moved || had_conflict;
        let buffer = self.sync_buffer_from_reading(&reading, false);
        let receipt = changed.then(|| {
            self.log.record(KernelEvent::SourceOpened {
                source: source_semantic_ref(source_ref, Some(&reading.revision.revision))
                    .unwrap_or_else(|_| fallback_source_ref(source_ref)),
                revision: reading.revision.revision.clone(),
                summary: format!(
                    "Re-read the canonical layer: now based on revision {}.",
                    short_revision(&reading.revision.revision)
                ),
            })
        });
        Ok(KernelOpOutcome {
            receipts: receipt.into_iter().collect(),
            result: KernelOpResult::SourceReread { buffer },
        })
    }

    fn owner_read(&self, project: Option<&str>, source_ref: &str) -> Result<SourceReading, String> {
        self.client
            .source_read(project, source_ref)
            .map_err(|error| error.to_string())
    }

    // -----------------------------------------------------------------------
    // Surfaces — S's own frame state (law 12, D16)
    // -----------------------------------------------------------------------

    fn surface_open(
        &mut self,
        surface_id: String,
        kind: String,
        source_ref: Option<String>,
        title: String,
    ) -> Result<KernelOpOutcome, String> {
        let surface = SurfaceState {
            surface_id: surface_id.clone(),
            kind,
            source_ref: source_ref.clone(),
            title,
        };
        self.surfaces.insert(surface_id.clone(), surface.clone());
        let semantic = surface
            .source_ref
            .as_deref()
            .and_then(|source_ref| source_semantic_ref(source_ref, None).ok());
        let receipt = self.log.record(KernelEvent::SurfaceChanged {
            surface_id,
            surface_ref: semantic,
            summary: format!("Surface opened: {}.", surface.title),
        });
        Ok(KernelOpOutcome {
            receipts: vec![receipt],
            result: KernelOpResult::SurfaceOpened {
                snapshot: self.snapshot(),
            },
        })
    }

    fn surface_close(&mut self, surface_id: String) -> Result<KernelOpOutcome, String> {
        let Some(surface) = self.surfaces.remove(&surface_id) else {
            return Err(format!("no surface `{surface_id}` is open"));
        };
        let mut receipts = vec![self.log.record(KernelEvent::SurfaceChanged {
            surface_id: surface.surface_id.clone(),
            surface_ref: surface
                .source_ref
                .as_deref()
                .and_then(|source_ref| source_semantic_ref(source_ref, None).ok()),
            summary: format!("Surface closed: {}.", surface.title),
        })];
        // Closing the focused subject's surface clears the focus relation —
        // a second state change, disclosed with its own receipt.
        let focused_this = self
            .focus
            .subject_ref()
            .map(|subject| {
                surface
                    .source_ref
                    .as_deref()
                    .is_some_and(|source_ref| source_ref == subject.ref_id)
            })
            .unwrap_or(false);
        if focused_this {
            self.focus.clear_subject();
            receipts.push(self.log.record(KernelEvent::FocusChanged {
                focus: self.focus.clone(),
            }));
        }
        Ok(KernelOpOutcome {
            receipts,
            result: KernelOpResult::SurfaceClosed {
                snapshot: self.snapshot(),
            },
        })
    }

    fn surface_focus(&mut self, surface_id: String) -> Result<KernelOpOutcome, String> {
        let Some(surface) = self.surfaces.get(&surface_id) else {
            return Err(format!("no surface `{surface_id}` is open"));
        };
        // Focus follows the active binding (D16). A surface with no
        // semantic ref (the sources index) holds no subject: the relation
        // returns to B0 No focus — an observation, never fabricated.
        let Some(source_ref) = surface.source_ref.clone() else {
            if self.focus.subject_ref().is_some() {
                self.focus.clear_subject();
                let receipt = self.log.record(KernelEvent::FocusChanged {
                    focus: self.focus.clone(),
                });
                return Ok(KernelOpOutcome {
                    receipts: vec![receipt],
                    result: KernelOpResult::SurfaceFocused {
                        snapshot: self.snapshot(),
                    },
                });
            }
            return Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::SurfaceFocused {
                    snapshot: self.snapshot(),
                },
            });
        };
        let already = self
            .focus
            .subject_ref()
            .is_some_and(|subject| subject.ref_id == source_ref);
        if already {
            return Ok(KernelOpOutcome {
                receipts: Vec::new(),
                result: KernelOpResult::SurfaceFocused {
                    snapshot: self.snapshot(),
                },
            });
        }
        self.focus
            .focus_subject(source_semantic_ref(&source_ref, None)?)
            .map_err(|error| error.to_string())?;
        let receipt = self.log.record(KernelEvent::FocusChanged {
            focus: self.focus.clone(),
        });
        Ok(KernelOpOutcome {
            receipts: vec![receipt],
            result: KernelOpResult::SurfaceFocused {
                snapshot: self.snapshot(),
            },
        })
    }
}

/// A shortened revision for summaries (the full revision rides in the
/// payload fields; summaries are observations, never the data).
fn short_revision(revision: &str) -> &str {
    let Some((_, tail)) = revision.rsplit_once(':') else {
        return revision;
    };
    tail
}

/// Unreachable in practice (a buffer exists only for a non-empty ref); kept
/// so an event is never suppressed by a wrapping failure.
fn fallback_source_ref(source_ref: &str) -> SemanticRef {
    SemanticRef {
        ref_id: source_ref.to_owned(),
        kind: refs::SOURCE_KIND.to_owned(),
        native_owner: refs::SOURCE_NATIVE_OWNER.to_owned(),
        provenance: refs::RefProvenance {
            source: refs::SOURCE_PROVENANCE.to_owned(),
            revision: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn state_and_listing_ops_emit_nothing() {
        let mut kernel = Kernel::new(CentralClient::with(
            "/nonexistent/ctrl-fixture".into(),
            None,
            "test".into(),
        ));
        let outcome = kernel.apply(KernelOp::State).unwrap();
        assert!(outcome.receipts.is_empty());
        // unavailable ctrl -> honest unavailable listing, not an error
        let outcome = kernel
            .apply(KernelOp::SourcesList { project: None })
            .unwrap();
        assert!(outcome.receipts.is_empty());
        let KernelOpResult::SourcesListed { listing } = outcome.result else {
            panic!("listing result");
        };
        assert!(listing.sources.is_empty());
        assert!(matches!(
            listing.availability,
            world::ListingAvailability::Unavailable { .. }
        ));
        assert_eq!(kernel.event_log().len(), 0);
    }

    #[test]
    fn an_edit_without_an_open_buffer_is_refused() {
        let mut kernel = Kernel::new(CentralClient::with(
            "/nonexistent/ctrl-fixture".into(),
            None,
            "test".into(),
        ));
        assert!(kernel
            .apply(KernelOp::SourceEdit {
                source_ref: "central:source:project:project:test:a.md".into(),
                content: "x".into(),
            })
            .is_err());
    }
}
