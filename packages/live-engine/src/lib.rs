//! Audio graph core for the Live shell — M1+M3 of
//! `docs/research/ableton-live-12.0.25/shell/SHELL-BLUEPRINT.md`, and the
//! one engine every Live part sounds in (O-I #849): MIDI tracks and their
//! instruments, sends and return tracks, the Main track, live events and
//! Export Audio of what was played.
//!
//! Owns the audio-graph domain (blueprint binding constraint 3): a typed
//! track/device/mixer graph, a beat clock, and the deterministic offline
//! render that doubles as the acceptance path. Device DSP lives in
//! `live-dynamics` (consumed, never reimplemented here); the document
//! model lives in `live-set` (consumed by `bridge`).
//!
//! Clean-room: written from `session-model.md`, the device dossiers and
//! the gated `live-dynamics` models only. No Ableton material, no
//! `evidence/` content. Constants that are engine decisions rather than
//! Live truth are marked at their definition.
//!
//! Realtime: [`engine`] splits a graph into the audio thread's
//! [`EngineCore`] (allocation-free, lock-free pull) and the control
//! side's [`EngineHandle`] (the owner operations); `realtime.rs` (feature
//! `realtime`, cpal) runs the core on the default output device. The
//! offline render stays the acceptance path and the default,
//! dependency-light build. The Torus instrument node over K8's typed API
//! is `k8.rs` (feature `k8`, built against an installed QL prefix).

pub mod bridge;
pub mod devices;
pub mod engine;
pub mod graph;
pub mod instruments;
pub mod ring;
pub mod wav;

#[cfg(feature = "k8")]
pub mod k8;
#[cfg(feature = "realtime")]
pub mod realtime;

pub use bridge::{bridge, BridgeResult, BridgeWarning};
pub use devices::{BypassDevice, EchoDevice, EchoParams, GainDevice, GlueDevice, ReverbDevice};
pub use engine::{
    engine, EngineCore, EngineEvent, EngineHandle, MixerState, Part, Performance, Refusal, Stamped,
};
pub use graph::{
    Clock, Device, Graph, GraphError, Instrument, MasterTrack, Note, ReturnTrack, TorusAct,
    TorusStrike, Track, MAX_RETURNS, TORUS_ACT_KEYS, TORUS_STRIKE_MODES, TORUS_WAITING,
};
pub use instruments::{OperatorInstrument, SilentInstrument};

#[cfg(feature = "k8")]
pub use k8::{K8Continuation, K8Field, K8Input, K8Instrument, K8KeyLaw};

#[cfg(feature = "realtime")]
pub use realtime::{EnginePlayer, Player, RealtimeError};
