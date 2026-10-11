//! Audio graph core for the Live shell — M1+M3 of
//! `docs/research/ableton-live-12.0.25/shell/SHELL-BLUEPRINT.md`.
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
//! Deliberately not here (see README): realtime MIDI input, warp/clip
//! playback, the unmeasured parts of the hosted devices (Echo's
//! synced-division mapping, filter/ducking/modulation/internal reverb;
//! Reverb's stereo decorrelation). Realtime audio output lives behind the
//! `realtime` feature (`realtime.rs`, phase-1 constraints documented
//! there and in the README); the offline render stays the acceptance
//! path and the default, dependency-light build.

pub mod bridge;
pub mod devices;
pub mod graph;
pub mod wav;

#[cfg(feature = "realtime")]
pub mod realtime;

pub use bridge::{bridge, BridgeResult, BridgeWarning};
pub use devices::{BypassDevice, EchoDevice, EchoParams, GainDevice, GlueDevice, ReverbDevice};
pub use graph::{Clock, Device, Graph, MasterTrack, Track};

#[cfg(feature = "realtime")]
pub use realtime::{Player, RealtimeError};
