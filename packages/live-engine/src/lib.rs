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

pub use bridge::{
    auto_filter_cutoff, auto_filter_hz, bridge, live_holds, rack_device, BridgeResult,
    BridgeWarning, AUTO_FILTER_TYPES, TORUS_DYNAMICS_LAW, TORUS_REVERB_LAW,
};
pub use devices::{
    convolver_normalisation, room_impulse, BypassDevice, CompressorDevice, DelayDevice,
    DelayParams, DynamicsDevice, DynamicsParams, EchoDevice, EchoParams, FilterDevice, FilterKind,
    FilterParams, GainDevice, GlueDevice, ReverbDevice, RoomDevice, RoomParams,
};
pub use engine::{
    engine, BlockStamp, DeviceAt, DeviceFace, Due, EngineCore, EngineEvent, EngineHandle,
    MixerState, Part, Performance, Refusal, Stamped, HAND_HOLD_MAX,
};
pub use graph::{
    ClipEdge, Clock, Device, Graph, GraphError, GroupTrack, Instrument, LaidSample, MasterTrack,
    Note, RackDevice, ReturnTrack, TorusAct, TorusHear, TorusStrike, Touch, Track, MAX_GROUPS,
    MAX_RETURNS, TORUS_ACT_KEYS, TORUS_HEAR_FRAMES, TORUS_HEAR_MODES, TORUS_STRIKE_MODES,
    TORUS_WAITING,
};
pub use instruments::{OperatorInstrument, SampleInstrument, SilentInstrument};

#[cfg(feature = "k8")]
pub use k8::{K8Continuation, K8Counts, K8Field, K8Input, K8Instrument, K8KeyLaw};

#[cfg(feature = "realtime")]
pub use realtime::{EnginePlayer, Player, RealtimeError};
